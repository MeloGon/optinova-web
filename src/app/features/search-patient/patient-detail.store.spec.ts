import { TestBed } from '@angular/core/testing';
import { appError } from '../../core/errors/app-error';
import { PatientLifecycleRepository } from '../../core/repositories/patient-lifecycle.repository';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { PaymentRepository } from '../../core/repositories/payment.repository';
import { ReviewRepository } from '../../core/repositories/review.repository';
import { SaleRepository } from '../../core/repositories/sale.repository';
import { FakePatientLifecycleRepository } from '../../testing/fake-patient-lifecycle.repository';
import { FakePatientRepository, fakePatient } from '../../testing/fake-patient.repository';
import { FakePaymentRepository, fakePayment } from '../../testing/fake-payment.repository';
import { FakeReviewRepository, fakeReview } from '../../testing/fake-review.repository';
import { FakeSaleRepository, fakeSale } from '../../testing/fake-sale.repository';
import { PatientDetailStore } from './patient-detail.store';

describe('PatientDetailStore', () => {
  let patientRepo: FakePatientRepository;
  let reviewRepo: FakeReviewRepository;
  let saleRepo: FakeSaleRepository;
  let paymentRepo: FakePaymentRepository;
  let lifecycleRepo: FakePatientLifecycleRepository;
  let store: PatientDetailStore;

  beforeEach(() => {
    patientRepo = new FakePatientRepository();
    patientRepo.patients = [fakePatient(1, 'MARIA LOPEZ')];
    reviewRepo = new FakeReviewRepository();
    saleRepo = new FakeSaleRepository();
    paymentRepo = new FakePaymentRepository(saleRepo);
    lifecycleRepo = new FakePatientLifecycleRepository(patientRepo);
    TestBed.configureTestingModule({
      providers: [
        PatientDetailStore,
        { provide: PatientRepository, useValue: patientRepo },
        { provide: ReviewRepository, useValue: reviewRepo },
        { provide: SaleRepository, useValue: saleRepo },
        { provide: PaymentRepository, useValue: paymentRepo },
        { provide: PatientLifecycleRepository, useValue: lifecycleRepo },
      ],
    });
    store = TestBed.inject(PatientDetailStore);
  });

  it('carga al paciente por id', async () => {
    await store.loadPatient('1');
    expect(store.patient()?.name).toBe('MARIA LOPEZ');
    expect(store.patientLoaded()).toBe(true);
    expect(store.patientError()).toBeNull();
  });

  it('paciente inexistente queda en null, sin error', async () => {
    await store.loadPatient('999');
    expect(store.patient()).toBeNull();
    expect(store.patientError()).toBeNull();
  });

  it('un error de red se guarda como mensaje', async () => {
    patientRepo.failWith = appError('network', 'Sin conexión.');
    await store.loadPatient('1');
    expect(store.patientError()).toBe('Sin conexión.');
  });

  it('editar guarda en el repositorio y actualiza el paciente en memoria', async () => {
    await store.loadPatient('1');
    const result = await store.update({ ...store.patient()!, name: 'MARIA CAMBIADA' });

    expect(result.ok).toBe(true);
    expect(patientRepo.updated.map((p) => p.name)).toEqual(['MARIA CAMBIADA']);
    expect(store.patient()?.name).toBe('MARIA CAMBIADA');
  });

  it('carga las medidas del paciente', async () => {
    reviewRepo.reviews = [fakeReview(1, '1'), fakeReview(2, '2')];
    expect(store.reviewsLoaded()).toBe(false);

    await store.loadReviews('1');

    expect(store.reviews().map((r) => r.id)).toEqual(['1']);
    expect(store.reviewsLoaded()).toBe(true);
  });

  it('crea/edita/elimina medidas en el repositorio de medidas', async () => {
    const { id, ...newReview } = fakeReview(0, '1');
    void id;
    await store.createReview(newReview);
    expect(reviewRepo.created.length).toBe(1);

    const review = fakeReview(1, '1');
    await store.updateReview(review);
    expect(reviewRepo.updated).toEqual([review]);

    await store.deleteReview('1');
    expect(reviewRepo.deleted).toEqual(['1']);
  });

  it('carga las ventas del paciente por paciente_id, paginadas', async () => {
    saleRepo.sales = [fakeSale(1, 'MARIA LOPEZ', '1'), fakeSale(2, 'JUAN GARCIA', '2')];

    await store.loadSales('1', 1, 10);

    expect(saleRepo.calls.at(-1)).toMatchObject({ patientId: '1', page: 1, pageSize: 10 });
    expect(store.sales().map((s) => s.id)).toEqual(['1']);
    expect(store.salesTotal()).toBe(1);
    expect(store.salesLoaded()).toBe(true);
  });

  it('carga las líneas y los pagos de una venta puntual', async () => {
    saleRepo.items['F-1'] = [];
    const result = await store.loadSaleItems('F-1');
    expect(result.ok).toBe(true);

    paymentRepo.payments = [fakePayment(1, '1')];
    const payments = await store.loadSalePayments('1');
    expect(payments.ok && payments.value.map((p) => p.id)).toEqual([1]);
  });

  it('registra un abono: inserta el pago y actualiza el saldo de la venta, sin refrescar por su cuenta', async () => {
    const sale = fakeSale(1, 'MARIA LOPEZ', '1');
    saleRepo.sales = [sale];

    const result = await store.registerPayment(sale, { saleId: '1', amount: 40, date: '2026-11-02', paymentMethod: 'efectivo', notes: '', type: 'abono_saldo' }, 'user-1');

    expect(result.ok).toBe(true);
    expect(paymentRepo.created.length).toBe(1);
    expect(saleRepo.appliedPayments).toEqual([{ saleId: '1', newAccount: 40, newRest: 60, paymentDate: '2026-11-02' }]);
    // No se llama a loadSales/loadPayments por su cuenta: eso lo decide quien llama.
    expect(store.salesLoaded()).toBe(false);
  });

  it('carga los pagos de todas las ventas del paciente', async () => {
    saleRepo.sales = [fakeSale(1, 'MARIA LOPEZ', '1'), fakeSale(2, 'OTRO', '2')];
    paymentRepo.payments = [fakePayment(1, '1'), fakePayment(2, '2')];

    await store.loadPayments('1');

    expect(store.payments().map((p) => p.id)).toEqual([1]);
    expect(store.paymentsLoaded()).toBe(true);
  });

  it('resolveLifecycle/applyLifecycle/restore delegan al repositorio de ciclo de vida', async () => {
    lifecycleRepo.statuses['1'] = { tier: 'reviews', reviewCount: 2, saleCount: 0 };

    const resolved = await store.resolveLifecycle('1');
    expect(resolved.ok && resolved.value.tier).toBe('reviews');

    const applied = await store.applyLifecycle('1');
    expect(applied.ok).toBe(true);
    expect(lifecycleRepo.applied).toEqual([{ patientId: '1', supervisor: undefined }]);

    await store.restore('1');
    expect(lifecycleRepo.restored).toEqual(['1']);
  });
});
