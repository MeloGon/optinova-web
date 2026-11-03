import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { SessionStore } from '../../core/auth/session.store';
import { Role } from '../../core/models/role';
import { AuthRepository } from '../../core/repositories/auth.repository';
import { DashboardRepository } from '../../core/repositories/dashboard.repository';
import { PaymentRepository } from '../../core/repositories/payment.repository';
import { SaleRepository } from '../../core/repositories/sale.repository';
import { ok } from '../../core/result';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { FakeAuthRepository, fakeProfile } from '../../testing/fake-auth.repository';
import {
  FakeDashboardRepository,
  failWith,
  fakeActivity,
  fakeAdminSummary,
  fakeLowStock,
  fakeSellerSummary,
  fakeTopProducts,
  noTopProducts,
} from '../../testing/fake-dashboard.repository';
import { FakePaymentRepository } from '../../testing/fake-payment.repository';
import { FakeSaleRepository } from '../../testing/fake-sale.repository';
import { DashboardPage } from './dashboard.page';

/**
 * El dashboard dibuja solo lo que el servidor devolvió para el rol: estas pruebas fijan que un
 * campo `null` (rol sin acceso) no deja rastro en la página. El filtro real vive en la DB.
 */
describe('DashboardPage', () => {
  let repo: FakeDashboardRepository;
  let payments: FakePaymentRepository;
  let sales: FakeSaleRepository;
  let harness: RouterTestingHarness;

  async function open(role: Role): Promise<void> {
    const auth = new FakeAuthRepository();
    auth.session = fakeProfile(role);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'dashboard', component: DashboardPage }]),
        { provide: DashboardRepository, useValue: repo },
        { provide: PaymentRepository, useValue: payments },
        { provide: SaleRepository, useValue: sales },
        { provide: AuthRepository, useValue: auth },
      ],
    });
    await TestBed.inject(SessionStore).restore();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/dashboard');
    await settle();
  }

  async function settle(): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
    TestBed.inject(ApplicationRef).tick();
  }

  const el = () => harness.routeNativeElement as HTMLElement;
  const text = () => el().textContent ?? '';
  const periodButton = (label: string) =>
    Array.from(el().querySelectorAll<HTMLButtonElement>('[role="radiogroup"] button')).find((b) =>
      b.textContent?.includes(label),
    )!;

  beforeEach(() => {
    repo = new FakeDashboardRepository();
    payments = new FakePaymentRepository();
    sales = new FakeSaleRepository();
  });

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = '')));

  it('vendedor: ve sus ventas y saldo, y no ve ingresos, métodos de pago, egresos ni auditoría', async () => {
    repo.summaryResult = ok(fakeSellerSummary());
    await open('vendedor');

    expect(text()).toContain('Mis ventas');
    expect(text()).toContain('Saldo por cobrar');
    expect(text()).toContain('Ventas de los últimos 7 días');
    expect(text()).not.toContain('Ingresos');
    expect(text()).not.toContain('Métodos de pago');
    expect(text()).not.toContain('Egresos del mes');
    expect(text()).not.toContain('Actividad reciente');
    expect(el().querySelector('#dashboard-branch')).toBeNull();
    expect(repo.activityCalls).toBe(0);
  });

  it('supervisor: ve ingresos y métodos de pago, pero no la auditoría ni el filtro de sucursal', async () => {
    repo.summaryResult = ok({ ...fakeAdminSummary(), role: 'supervisor', scope: 'branch', branch: 'MEDILENT' });
    await open('supervisor');

    expect(text()).toContain('Ingresos');
    expect(text()).toContain('Métodos de pago de hoy');
    expect(text()).toContain('Sucursal MEDILENT');
    expect(text()).not.toContain('Actividad reciente');
    expect(el().querySelector('#dashboard-branch')).toBeNull();
    expect(repo.activityCalls).toBe(0);
  });

  it('admin: ve todo, incluida la auditoría y el filtro de sucursal', async () => {
    repo.summaryResult = ok(fakeAdminSummary());
    repo.activityResult = ok([fakeActivity()]);
    await open('admin');

    expect(text()).toContain('Ingresos');
    expect(text()).toContain('Egresos del mes por categoría');
    expect(text()).toContain('Actividad reciente');
    expect(text()).toContain('registró la venta 100058 (vendedor: BETO)');
    expect(el().querySelector('#dashboard-branch')).not.toBeNull();
    expect(repo.activityCalls).toBe(1);
  });

  it('filtrar por sucursal vuelve a pedir el resumen con esa sucursal', async () => {
    repo.summaryResult = ok(fakeAdminSummary());
    await open('admin');

    const select = el().querySelector<HTMLSelectElement>('#dashboard-branch')!;
    select.value = 'MEDILENT';
    select.dispatchEvent(new Event('change'));
    await settle();

    expect(repo.summaryCalls).toEqual([
      { branch: null, period: 'today' },
      { branch: 'MEDILENT', period: 'today' },
    ]);
  });

  describe('periodo y variación', () => {
    it('empieza en "hoy" y muestra la variación contra ayer con su flecha en texto', async () => {
      repo.summaryResult = ok(fakeSellerSummary()); // 500 hoy vs 400 ayer
      await open('vendedor');

      expect(periodButton('Hoy').getAttribute('aria-checked')).toBe('true');
      expect(text()).toContain('25%');
      expect(text()).toContain('Sube');
      expect(text()).toContain('vs ayer');
    });

    it('elegir "7 días" vuelve a pedir el resumen con ese periodo', async () => {
      await open('vendedor');

      periodButton('7 días').click();
      await settle();

      expect(repo.summaryCalls.at(-1)).toEqual({ branch: null, period: 'week' });
    });

    it('el rótulo de comparación sigue al periodo de los datos recibidos', async () => {
      repo.summaryResult = ok({ ...fakeSellerSummary(), period: 'month' });
      await open('vendedor');

      expect(text()).toContain('vs el mes anterior');
      expect(text()).toContain('Ventas del mes');
    });

    it('una baja se muestra como baja, no solo en rojo', async () => {
      const base = fakeSellerSummary();
      repo.summaryResult = ok({
        ...base,
        kpis: { ...base.kpis, mySales: { ...base.kpis.mySales, total: 200, previousTotal: 400 } },
      });
      await open('vendedor');

      expect(text()).toContain('Baja');
      expect(text()).toContain('50%');
    });

    it('sin periodo anterior con ventas no inventa un porcentaje', async () => {
      const base = fakeSellerSummary();
      repo.summaryResult = ok({
        ...base,
        kpis: { ...base.kpis, mySales: { ...base.kpis.mySales, previousTotal: 0 } },
      });
      await open('vendedor');

      expect(text()).toContain('Sin comparación vs ayer');
      expect(text()).not.toContain('Sube');
    });

    it('el saldo por cobrar y los pacientes no llevan variación (no dependen del periodo)', async () => {
      await open('vendedor');

      const cards = Array.from(el().querySelectorAll('onv-stat-card'));
      const receivable = cards.find((c) => c.textContent?.includes('Saldo por cobrar'))!;
      const patients = cards.find((c) => c.textContent?.includes('Pacientes'))!;

      expect(receivable.textContent).not.toContain('vs ');
      expect(patients.textContent).not.toContain('vs ');
    });

    it('dibuja la tendencia de los KPIs con descripción accesible', async () => {
      await open('vendedor');

      expect(el().querySelector('svg[aria-label="Tendencia de tus ventas"]')).not.toBeNull();
    });
  });

  describe('cobranza', () => {
    const cobrar = (name: string) =>
      Array.from(el().querySelectorAll<HTMLButtonElement>('button')).find(
        (b) => b.getAttribute('aria-label') === `Cobrar a ${name}`,
      )!;

    it('muestra el saldo por antigüedad y las ventas con mayor saldo, con su edad en texto', async () => {
      repo.summaryResult = ok(fakeAdminSummary());
      await open('admin');

      expect(text()).toContain('Cobranza');
      expect(text()).toContain('1250.00'.replace('1250.00', '1,250.00') + ' por cobrar en 3 ventas');
      expect(text()).toContain('0 a 7 días');
      expect(text()).toContain('8 a 30 días');
      expect(text()).toContain('Más de 30 días');
      expect(text()).toContain('LUIS VEGA');
      expect(text()).toContain('45 días');
      expect(text()).toContain('Hoy');
    });

    it('la barra apilada reparte el saldo (900 de 1250 es 72%)', async () => {
      repo.summaryResult = ok(fakeAdminSummary());
      await open('admin');

      expect(text()).toContain('72%');
      expect(el().querySelector('[aria-label="Saldo por cobrar según su antigüedad"]')).not.toBeNull();
    });

    const verTodas = () =>
      Array.from(el().querySelectorAll<HTMLAnchorElement>('a')).find((a) => a.textContent?.includes('ventas con saldo'));

    it('"Ver las N ventas con saldo" abre Historial ya filtrado por "Con saldo"', async () => {
      const base = fakeAdminSummary();
      repo.summaryResult = ok({ ...base, collections: { ...base.collections, count: 9 } });
      await open('admin');

      expect(verTodas()?.getAttribute('href')).toBe('/dashboard/sales-history?status=balance');
    });

    it('si el admin eligió una sucursal, el enlace la lleva al Historial', async () => {
      const base = fakeAdminSummary();
      repo.summaryResult = ok({ ...base, branch: 'MEDILENT', collections: { ...base.collections, count: 9 } });
      await open('admin');

      expect(verTodas()?.getAttribute('href')).toBe('/dashboard/sales-history?status=balance&branch=MEDILENT');
    });

    it('el enlace no aparece si la lista ya muestra todas las ventas con saldo', async () => {
      repo.summaryResult = ok(fakeAdminSummary()); // 3 con saldo, 3 listadas
      await open('admin');

      expect(verTodas()).toBeUndefined();
    });

    it('sin saldos pendientes muestra un estado vacío en vez de una tabla vacía', async () => {
      repo.summaryResult = ok(fakeSellerSummary());
      await open('vendedor');

      expect(text()).toContain('Sin saldos por cobrar');
      expect(el().querySelector('button[aria-label^="Cobrar a"]')).toBeNull();
    });

    it('"Cobrar" abre el diálogo de abono con el saldo completo precargado', async () => {
      repo.summaryResult = ok(fakeAdminSummary());
      await open('admin');

      cobrar('LUIS VEGA').click();
      await settle();

      const dialog = document.querySelector('.cdk-overlay-container')!;
      // El diálogo identifica la venta por su folio y su saldo; el importe viene precargado con todo el saldo.
      expect(dialog.textContent).toContain('F-30 · saldo actual S/. 900.00');
      expect(dialog.textContent).toContain('Registrar S/. 900.00');
    });

    it('registrar el abono guarda el pago, avisa y vuelve a pedir el resumen', async () => {
      repo.summaryResult = ok(fakeAdminSummary());
      await open('admin');
      const before = repo.summaryCalls.length;

      cobrar('LUIS VEGA').click();
      await settle();
      document.querySelector<HTMLButtonElement>('.cdk-overlay-container button[type="submit"]')!.click();
      await settle();
      await settle();

      expect(payments.created).toHaveLength(1);
      expect(payments.created[0].payment).toMatchObject({ saleId: '30', amount: 900 });
      expect(sales.appliedPayments[0]).toMatchObject({ saleId: '30', newRest: 0 });
      expect(repo.summaryCalls.length).toBe(before + 1);
      expect(TestBed.inject(ToastService).toasts().some((t) => t.title === 'Abono registrado')).toBe(true);
    });
  });

  describe('más vendido y ranking del mes', () => {
    it('muestra los armazones más vendidos con sus unidades e importe, y nombra el mes', async () => {
      repo.summaryResult = ok(fakeAdminSummary());
      await open('admin');

      expect(text()).toContain('Más vendido de noviembre');
      expect(text()).toContain('Ray-Ban RB5154');
      expect(text()).toContain('3 unidades');
      expect(text()).toContain('1 unidad');
    });

    it('cambiar a "Marcas" muestra el top por marca sin volver a pedir datos', async () => {
      repo.summaryResult = ok(fakeAdminSummary());
      await open('admin');
      const calls = repo.summaryCalls.length;

      periodButton('Marcas').click();
      await settle();

      expect(text()).toContain('4 unidades');
      expect(text()).not.toContain('Ray-Ban RB5154');
      expect(repo.summaryCalls.length).toBe(calls);
    });

    it('admin ve el ranking de vendedores con su importe y cuántas ventas', async () => {
      repo.summaryResult = ok(fakeAdminSummary());
      await open('admin');

      expect(text()).toContain('Vendedores de noviembre');
      expect(text()).toContain('Vendedor Test');
      expect(text()).toContain('5 ventas');
    });

    it('el vendedor no ve el ranking (llega en null), pero sí el más vendido de sus ventas', async () => {
      repo.summaryResult = ok({ ...fakeSellerSummary(), topProducts: fakeTopProducts() });
      await open('vendedor');

      expect(text()).not.toContain('Vendedores de noviembre');
      expect(text()).toContain('Más vendido de noviembre');
      expect(text()).toContain('Ray-Ban RB5154');
    });

    it('sin ventas de armazones o de vendedores muestra estados vacíos', async () => {
      repo.summaryResult = ok({ ...fakeAdminSummary(), topProducts: noTopProducts(), sellerRanking: [] });
      await open('admin');

      expect(text()).toContain('Aún no hay armazones vendidos');
      expect(text()).toContain('Aún no hay ventas este mes');
    });
  });

  describe('stock bajo', () => {
    it('lista los armazones con 1 o 2 unidades, con cuántas quedan en texto, y cuenta los agotados', async () => {
      repo.summaryResult = ok(fakeAdminSummary());
      await open('admin');

      expect(text()).toContain('Stock bajo');
      expect(text()).toContain('OAKLEY MOD-014');
      expect(text()).toContain('Queda 1');
      expect(text()).toContain('Quedan 2');
      expect(text()).toContain('5 agotados');
    });

    it('un armazón sin marca ni modelo se nombra por su descripción', async () => {
      repo.summaryResult = ok(fakeAdminSummary());
      await open('admin');

      expect(text()).toContain('ARMAZON GENERICO');
    });

    it('admin ve de qué sucursal es cada armazón; el vendedor, que solo ve su inventario, no', async () => {
      repo.summaryResult = ok(fakeAdminSummary());
      await open('admin');
      expect(text()).toContain('OFTALVISION');
    });

    it('el vendedor no ve el rótulo de sucursal en cada armazón', async () => {
      repo.summaryResult = ok({ ...fakeSellerSummary(), lowStock: fakeLowStock() });
      await open('vendedor');

      expect(text()).toContain('OAKLEY MOD-014');
      expect(text()).not.toContain('OFTALVISION');
    });

    it('avisa cuántos más hay cuando la lista se corta', async () => {
      const base = fakeAdminSummary();
      repo.summaryResult = ok({ ...base, lowStock: { ...base.lowStock, count: 9 } });
      await open('admin');

      expect(text()).toContain('y 6 más con 1 o 2 unidades');
    });

    it('sin armazones por reponer muestra "Stock al día"', async () => {
      repo.summaryResult = ok(fakeSellerSummary());
      await open('vendedor');

      expect(text()).toContain('Stock al día');
    });
  });

  it('muestra el error del resumen con un botón para reintentar', async () => {
    repo.summaryResult = failWith('Sin conexión');
    await open('vendedor');

    expect(el().querySelector('[role="alert"]')?.textContent).toContain('Sin conexión');

    repo.summaryResult = ok(fakeSellerSummary());
    const retry = Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes('Reintentar'))!;
    retry.click();
    await settle();

    expect(el().querySelector('[role="alert"]')).toBeNull();
    expect(text()).toContain('Mis ventas');
  });

  it('sin ventas muestra el estado vacío con acceso a Nueva venta', async () => {
    repo.summaryResult = ok({ ...fakeSellerSummary(), recentSales: [] });
    await open('vendedor');

    expect(text()).toContain('Aún no hay ventas');
  });

  it('el saludo usa el nombre de pila del perfil', async () => {
    repo.summaryResult = ok(fakeSellerSummary());
    await open('vendedor');

    const name = fakeProfile('vendedor').name.split(' ')[0];
    expect(text()).toMatch(new RegExp(`(Buenos días|Buenas tardes|Buenas noches), ${name}`));
  });
});
