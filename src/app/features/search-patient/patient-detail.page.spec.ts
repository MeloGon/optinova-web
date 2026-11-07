import { ApplicationRef, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { SessionStore } from '../../core/auth/session.store';
import { Role } from '../../core/models/role';
import { AuthRepository } from '../../core/repositories/auth.repository';
import { PatientLifecycleRepository } from '../../core/repositories/patient-lifecycle.repository';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { PaymentRepository } from '../../core/repositories/payment.repository';
import { ReviewRepository } from '../../core/repositories/review.repository';
import { SaleRepository } from '../../core/repositories/sale.repository';
import { FakeAuthRepository, fakeProfile } from '../../testing/fake-auth.repository';
import { FakePatientLifecycleRepository } from '../../testing/fake-patient-lifecycle.repository';
import { FakePatientRepository, fakePatient } from '../../testing/fake-patient.repository';
import { FakePaymentRepository, fakePayment } from '../../testing/fake-payment.repository';
import { FakeReviewRepository, fakeReview } from '../../testing/fake-review.repository';
import { FakeSaleRepository, fakeSale } from '../../testing/fake-sale.repository';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { PatientDetailPage } from './patient-detail.page';

/** Destino de "← Buscar paciente" y de la navegación tras eliminar: no hace falta la página real. */
@Component({ selector: 'app-stub-list', template: '' })
class StubListPage {}

describe('PatientDetailPage', () => {
  let patientRepo: FakePatientRepository;
  let reviewRepo: FakeReviewRepository;
  let saleRepo: FakeSaleRepository;
  let paymentRepo: FakePaymentRepository;
  let lifecycleRepo: FakePatientLifecycleRepository;
  let harness: RouterTestingHarness;

  async function open(url: string, role: Role = 'vendedor'): Promise<void> {
    const auth = new FakeAuthRepository();
    auth.session = fakeProfile(role);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: 'dashboard/search-patient', component: StubListPage },
            { path: 'dashboard/search-patient/:id', component: PatientDetailPage },
          ],
          withComponentInputBinding(),
        ),
        { provide: PatientRepository, useValue: patientRepo },
        { provide: ReviewRepository, useValue: reviewRepo },
        { provide: SaleRepository, useValue: saleRepo },
        { provide: PaymentRepository, useValue: paymentRepo },
        { provide: PatientLifecycleRepository, useValue: lifecycleRepo },
        { provide: AuthRepository, useValue: auth },
      ],
    });
    await TestBed.inject(SessionStore).restore();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle();
  }

  async function settle(): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
    TestBed.inject(ApplicationRef).tick();
  }

  const el = () => harness.routeNativeElement as HTMLElement;
  const text = () => el().textContent ?? '';
  const toasts = () => TestBed.inject(ToastService).toasts();
  const router = () => TestBed.inject(Router);
  const byText = (root: ParentNode, selector: string, label: string) =>
    Array.from(root.querySelectorAll<HTMLElement>(selector)).find((e) => e.textContent?.includes(label));

  beforeEach(() => {
    patientRepo = new FakePatientRepository();
    patientRepo.patients = [{ ...fakePatient(1, 'MARIA LOPEZ'), branch: 'OFTALVISION', phone: '999111222' }];
    reviewRepo = new FakeReviewRepository();
    saleRepo = new FakeSaleRepository();
    paymentRepo = new FakePaymentRepository(saleRepo);
    lifecycleRepo = new FakePatientLifecycleRepository(patientRepo);
  });

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = '')));

  it('carga y muestra el encabezado del paciente', async () => {
    await open('/dashboard/search-patient/1');

    expect(text()).toContain('MARIA LOPEZ');
    expect(text()).toContain('OFTALVISION');
    expect(text()).toContain('999111222');
    expect(el().querySelector('a[href="/dashboard/sell"]')).not.toBeNull();
  });

  it('paciente archivado muestra la insignia', async () => {
    patientRepo.patients[0] = { ...patientRepo.patients[0], archivedOn: '2026-10-20' };
    await open('/dashboard/search-patient/1');
    expect(text()).toContain('Archivado');
  });

  it('paciente inexistente muestra el empty-state', async () => {
    await open('/dashboard/search-patient/999');
    expect(text()).toContain('Paciente no encontrado');
  });

  describe('pestañas', () => {
    it('empieza en Revisiones y cambia la URL al elegir otra', async () => {
      await open('/dashboard/search-patient/1');
      expect(text()).toContain('Este paciente no tiene medidas registradas.');

      byText(el(), 'button[role=tab]', 'Ventas')!.click();
      await settle();

      expect(router().url).toContain('tab=sales');
      expect(text()).toContain('Sin ventas');
    });

    it('cuentan medidas, ventas y pagos', async () => {
      reviewRepo.reviews = [fakeReview(1, '1')];
      saleRepo.sales = [fakeSale(1, 'MARIA LOPEZ', '1')];
      paymentRepo.payments = [fakePayment(1, '1')];

      await open('/dashboard/search-patient/1');

      const tabsText = el().querySelector('[role=tablist]')!.textContent ?? '';
      expect(tabsText).toContain('Revisiones');
      expect(tabsText).toContain('1');
    });
  });

  describe('Revisiones', () => {
    it('muestra las medidas del paciente', async () => {
      reviewRepo.reviews = [fakeReview(1, '1', { date: '2026-09-01', reasonConsult: 'Revisión anual' })];
      await open('/dashboard/search-patient/1');

      expect(text()).toContain('Revisión anual');
      expect(reviewRepo.calls).toEqual(['1']);
    });

    it('agregar medida la crea, recarga la lista y avisa', async () => {
      await open('/dashboard/search-patient/1');
      byText(el(), 'button', 'Agregar medida')!.click();
      await settle();

      const field = document.body.querySelector<HTMLInputElement>('[aria-label="ESF OD"]')!;
      field.value = '-1.00';
      field.dispatchEvent(new Event('input'));
      document.body.querySelector('[role=dialog] form')!.dispatchEvent(new Event('submit'));
      await settle();

      expect(reviewRepo.created.length).toBe(1);
      expect(toasts().map((t) => t.title)).toContain('Medida agregada');
      expect(reviewRepo.calls.filter((id) => id === '1').length).toBe(2); // carga inicial + recarga
    });

    it('eliminar una medida pide confirmación, la quita y avisa', async () => {
      reviewRepo.reviews = [fakeReview(1, '1')];
      await open('/dashboard/search-patient/1');

      document.body.querySelector<HTMLButtonElement>('[aria-label^="Eliminar medida"]')!.click();
      await settle();
      byText(document.body, '[role=alertdialog] button', 'Eliminar medida')!.click();
      await settle();

      expect(reviewRepo.deleted).toEqual(['1']);
      expect(toasts().map((t) => t.title)).toContain('Medida eliminada');
    });
  });

  describe('Ventas', () => {
    it('lista las ventas del paciente, filtradas por paciente_id', async () => {
      saleRepo.sales = [fakeSale(1, 'MARIA LOPEZ', '1'), fakeSale(2, 'OTRO PACIENTE', '2')];
      await open('/dashboard/search-patient/1?tab=sales');

      expect(saleRepo.calls.at(-1)).toMatchObject({ patientId: '1' });
      expect(text()).toContain('F-1');
      expect(text()).not.toContain('F-2');
    });

    it('"Ver detalle" abre el diálogo con las líneas y pagos de la venta', async () => {
      saleRepo.sales = [fakeSale(1, 'MARIA LOPEZ', '1')];
      saleRepo.items['F-1'] = [];
      await open('/dashboard/search-patient/1?tab=sales');

      document.body.querySelector<HTMLButtonElement>('[aria-label^="Ver venta"]')!.click();
      await settle();

      expect(document.body.querySelector('[role=dialog]')).not.toBeNull();
    });

    it('"Registrar pago" solo aparece si hay saldo, y registra el abono', async () => {
      const sale = { ...fakeSale(1, 'MARIA LOPEZ', '1'), totalWithDiscount: 100, account: 0, rest: 100 };
      saleRepo.sales = [sale];
      await open('/dashboard/search-patient/1?tab=sales');

      document.body.querySelector<HTMLButtonElement>('[aria-label^="Registrar pago"]')!.click();
      await settle();

      // El importe ya viene precargado con el saldo completo (y el método, con el primero
      // configurado): alcanza con enviar el formulario tal cual.
      document.body.querySelector('[role=dialog] form')!.dispatchEvent(new Event('submit'));
      await settle();

      expect(paymentRepo.registered.length).toBe(1);
      expect(toasts().map((t) => t.title)).toContain('Abono registrado');
    });
  });

  describe('Pagos', () => {
    it('lista los pagos de todas las ventas del paciente', async () => {
      saleRepo.sales = [fakeSale(1, 'MARIA LOPEZ', '1')];
      paymentRepo.payments = [fakePayment(1, '1', 75)];
      await open('/dashboard/search-patient/1?tab=payments');

      expect(text()).toMatch(/75/);
    });
  });

  describe('encabezado', () => {
    it('editar guarda los cambios y avisa', async () => {
      await open('/dashboard/search-patient/1');
      byText(el(), 'button', 'Editar')!.click();
      await settle();

      const name = document.body.querySelector<HTMLInputElement>('#patient-name')!;
      name.value = 'MARIA CAMBIADA';
      name.dispatchEvent(new Event('input'));
      document.body.querySelector('[role=dialog] form')!.dispatchEvent(new Event('submit'));
      await settle();

      expect(patientRepo.updated.map((p) => p.name)).toEqual(['MARIA CAMBIADA']);
      expect(toasts().map((t) => t.title)).toContain('Paciente actualizado');
    });

    it('eliminar sin relaciones, al confirmar, borra y vuelve a Buscar paciente', async () => {
      await open('/dashboard/search-patient/1');
      byText(el(), 'button', 'Eliminar…')!.click();
      await settle();
      byText(document.body, '[role=alertdialog] button', 'Eliminar paciente')!.click();
      await settle();

      expect(lifecycleRepo.deleted).toEqual(['1']);
      expect(router().url).toBe('/dashboard/search-patient');
    });

    it('paciente archivado: admin ve "Restaurar" en vez de "Eliminar…", y restaurar recarga la ficha', async () => {
      patientRepo.patients[0] = { ...patientRepo.patients[0], archivedOn: '2026-10-20' };
      await open('/dashboard/search-patient/1', 'admin');

      expect(byText(el(), 'button', 'Eliminar…')).toBeUndefined();
      byText(el(), 'button', 'Restaurar')!.click();
      await settle();
      byText(document.body, '[role=alertdialog] button', 'Restaurar paciente')!.click();
      await settle();

      expect(lifecycleRepo.restored).toEqual(['1']);
      expect(router().url).toContain('/dashboard/search-patient/1'); // no navega: se queda en la ficha
      expect(text()).not.toContain('Archivado');
      expect(byText(el(), 'button', 'Eliminar…')).not.toBeUndefined();
    });

    it('paciente archivado: vendedor/supervisor no ven ni "Eliminar…" ni "Restaurar"', async () => {
      patientRepo.patients[0] = { ...patientRepo.patients[0], archivedOn: '2026-10-20' };
      await open('/dashboard/search-patient/1', 'supervisor');

      expect(byText(el(), 'button', 'Eliminar…')).toBeUndefined();
      expect(byText(el(), 'button', 'Restaurar')).toBeUndefined();
    });
  });
});
