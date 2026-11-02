import { Injectable, computed, inject, signal } from '@angular/core';
import { AppError } from '../../core/errors/app-error';
import { Patient } from '../../core/models/patient';
import { Payment } from '../../core/models/payment';
import { Review } from '../../core/models/review';
import { Sale } from '../../core/models/sale';
import { SaleItem } from '../../core/models/sale-item';
import { NewPayment, PaymentRepository } from '../../core/repositories/payment.repository';
import {
  PatientLifecycleRepository,
  PatientLifecycleResult,
  PatientLifecycleStatus,
  SupervisorCredentials,
} from '../../core/repositories/patient-lifecycle.repository';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { NewReview, ReviewRepository } from '../../core/repositories/review.repository';
import { SaleRepository } from '../../core/repositories/sale.repository';
import { Result } from '../../core/result';

interface PatientState {
  patient: Patient | null;
  loading: boolean;
  error: string | null;
  loaded: boolean;
}

interface SalesState {
  items: Sale[];
  total: number;
  loading: boolean;
  loaded: boolean;
}

/**
 * Estado de la ficha de paciente (S-03): el paciente y sus 3 pestañas (Revisiones/Ventas/Pagos).
 * Se provee en la página (`providers: [PatientDetailStore]`): nace y muere con ella, igual que
 * `SearchPatientStore`. No hay equivalente en Flutter (esa pantalla nunca existió ahí).
 */
@Injectable()
export class PatientDetailStore {
  private readonly repo = inject(PatientRepository);
  private readonly reviewRepo = inject(ReviewRepository);
  private readonly saleRepo = inject(SaleRepository);
  private readonly paymentRepo = inject(PaymentRepository);
  private readonly lifecycleRepo = inject(PatientLifecycleRepository);

  private readonly patientState = signal<PatientState>({
    patient: null,
    loading: false,
    error: null,
    loaded: false,
  });
  readonly patient = computed(() => this.patientState().patient);
  readonly patientLoading = computed(() => this.patientState().loading);
  readonly patientError = computed(() => this.patientState().error);
  readonly patientLoaded = computed(() => this.patientState().loaded);

  private readonly reviewsState = signal<Review[] | null>(null);
  readonly reviews = computed(() => this.reviewsState() ?? []);
  readonly reviewsLoaded = computed(() => this.reviewsState() !== null);

  private readonly salesState = signal<SalesState>({ items: [], total: 0, loading: false, loaded: false });
  readonly sales = computed(() => this.salesState().items);
  readonly salesTotal = computed(() => this.salesState().total);
  readonly salesLoaded = computed(() => this.salesState().loaded);

  private readonly paymentsState = signal<Payment[] | null>(null);
  readonly payments = computed(() => this.paymentsState() ?? []);
  readonly paymentsLoaded = computed(() => this.paymentsState() !== null);

  async loadPatient(id: string): Promise<void> {
    this.patientState.update((s) => ({ ...s, loading: true, error: null }));
    const result = await this.repo.getById(id);
    if (result.ok) {
      this.patientState.set({ patient: result.value, loading: false, error: null, loaded: true });
    } else {
      this.patientState.update((s) => ({ ...s, loading: false, error: result.error.message, loaded: true }));
    }
  }

  async update(patient: Patient): Promise<Result<void, AppError>> {
    const result = await this.repo.update(patient);
    if (result.ok) this.patientState.update((s) => ({ ...s, patient }));
    return result;
  }

  async loadReviews(patientId: string): Promise<void> {
    const result = await this.reviewRepo.getByPatient(patientId);
    if (result.ok) this.reviewsState.set(result.value);
  }

  async createReview(review: NewReview): Promise<Result<Review, AppError>> {
    return this.reviewRepo.create(review);
  }

  async updateReview(review: Review): Promise<Result<void, AppError>> {
    return this.reviewRepo.update(review);
  }

  async deleteReview(id: string): Promise<Result<void, AppError>> {
    return this.reviewRepo.delete(id);
  }

  async loadSales(patientId: string, page: number, pageSize: number): Promise<void> {
    this.salesState.update((s) => ({ ...s, loading: true }));
    const result = await this.saleRepo.search({ query: '', branch: null, date: null, status: 'all', page, pageSize, patientId });
    if (result.ok) {
      this.salesState.set({ items: result.value.items, total: result.value.total, loading: false, loaded: true });
    } else {
      this.salesState.update((s) => ({ ...s, loading: false, loaded: true }));
    }
  }

  async loadSaleItems(folio: string): Promise<Result<SaleItem[], AppError>> {
    return this.saleRepo.getItems(folio);
  }

  async loadSalePayments(saleId: string): Promise<Result<Payment[], AppError>> {
    return this.paymentRepo.listBySale(saleId);
  }

  /**
   * = `SalesHistoryStore.registerPayment`: dos pasos, no atómico (mismo criterio ya aceptado ahí).
   * No refresca Ventas/Pagos por su cuenta: quien llama ya sabe con qué página/paciente hacerlo
   * (ver `PatientDetailPage.registerPayment`).
   */
  async registerPayment(sale: Sale, payment: NewPayment, registeredById: string): Promise<Result<void, AppError>> {
    const inserted = await this.paymentRepo.create(payment, registeredById);
    if (!inserted.ok) return inserted;

    const newAccount = sale.account + payment.amount;
    const newRest = Math.max(sale.totalWithDiscount - newAccount, 0);
    return this.saleRepo.applyPayment(sale.id, newAccount, newRest, payment.date);
  }

  async loadPayments(patientId: string): Promise<void> {
    const result = await this.paymentRepo.listByPatient(patientId);
    if (result.ok) this.paymentsState.set(result.value);
  }

  async resolveLifecycle(patientId: string): Promise<Result<PatientLifecycleStatus, AppError>> {
    return this.lifecycleRepo.resolve(patientId);
  }

  async applyLifecycle(
    patientId: string,
    supervisor?: SupervisorCredentials,
  ): Promise<Result<PatientLifecycleResult, AppError>> {
    return this.lifecycleRepo.apply(patientId, supervisor);
  }

  async restore(patientId: string): Promise<Result<void, AppError>> {
    return this.lifecycleRepo.restore(patientId);
  }
}
