import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { SessionStore } from '../../core/auth/session.store';
import { Role } from '../../core/models/role';
import { AuthRepository } from '../../core/repositories/auth.repository';
import { DashboardRepository } from '../../core/repositories/dashboard.repository';
import { ok } from '../../core/result';
import { FakeAuthRepository, fakeProfile } from '../../testing/fake-auth.repository';
import {
  FakeDashboardRepository,
  failWith,
  fakeActivity,
  fakeAdminSummary,
  fakeSellerSummary,
} from '../../testing/fake-dashboard.repository';
import { DashboardPage } from './dashboard.page';

/**
 * El dashboard dibuja solo lo que el servidor devolvió para el rol: estas pruebas fijan que un
 * campo `null` (rol sin acceso) no deja rastro en la página. El filtro real vive en la DB.
 */
describe('DashboardPage', () => {
  let repo: FakeDashboardRepository;
  let harness: RouterTestingHarness;

  async function open(role: Role): Promise<void> {
    const auth = new FakeAuthRepository();
    auth.session = fakeProfile(role);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'dashboard', component: DashboardPage }]),
        { provide: DashboardRepository, useValue: repo },
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

  beforeEach(() => {
    repo = new FakeDashboardRepository();
  });

  it('vendedor: ve sus ventas y saldo, y no ve ingresos, métodos de pago, egresos ni auditoría', async () => {
    repo.summaryResult = ok(fakeSellerSummary());
    await open('vendedor');

    expect(text()).toContain('Mis ventas hoy');
    expect(text()).toContain('Saldo por cobrar');
    expect(text()).toContain('Ventas de los últimos 7 días');
    expect(text()).not.toContain('Ingresos hoy');
    expect(text()).not.toContain('Métodos de pago de hoy');
    expect(text()).not.toContain('Egresos del mes');
    expect(text()).not.toContain('Actividad reciente');
    expect(el().querySelector('#dashboard-branch')).toBeNull();
    expect(repo.activityCalls).toBe(0);
  });

  it('supervisor: ve ingresos y métodos de pago, pero no la auditoría ni el filtro de sucursal', async () => {
    repo.summaryResult = ok({ ...fakeAdminSummary(), role: 'supervisor', scope: 'branch', branch: 'MEDILENT' });
    await open('supervisor');

    expect(text()).toContain('Ingresos hoy');
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

    expect(text()).toContain('Ingresos hoy');
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

    expect(repo.summaryCalls).toEqual([null, 'MEDILENT']);
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
    expect(text()).toContain('Mis ventas hoy');
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
