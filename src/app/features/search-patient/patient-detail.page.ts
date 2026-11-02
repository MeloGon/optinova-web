import { Dialog } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  LucideArchiveRestore,
  LucideArrowLeft,
  LucideDynamicIcon,
  LucideEdit,
  LucideEye,
  LucideHandCoins,
  LucideMapPin,
  LucidePhone,
  LucideShoppingCart,
  LucideTrash2,
  LucideUserPlus,
  LucideUserX,
} from '@lucide/angular';
import { SessionStore } from '../../core/auth/session.store';
import { Review } from '../../core/models/review';
import { Sale } from '../../core/models/sale';
import { NewPayment } from '../../core/repositories/payment.repository';
import { Avatar } from '../../shared/ui/avatar/avatar';
import { Badge } from '../../shared/ui/badge/badge';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { Paginator } from '../../shared/ui/paginator/paginator';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { OnvTable, TableCard } from '../../shared/ui/table/table';
import { Tabs, TabOption, tabId, tabPanelId } from '../../shared/ui/tabs/tabs';
import { ToastService } from '../../shared/ui/toast/toast.service';
import {
  RegisterPaymentDialog,
  RegisterPaymentDialogData,
  REGISTER_PAYMENT_TITLE_ID,
} from '../sales-history/components/register-payment-dialog';
import {
  SaleDetailsDialog,
  SaleDetailsDialogData,
  SaleDetailsResult,
  SALE_DETAILS_TITLE_ID,
} from '../sales-history/components/sale-details-dialog';
import { saleStatus } from '../sales-history/sale-status';
import { ADD_REVIEW_TITLE_ID, AddReviewDialog, AddReviewDialogData } from './components/add-review-dialog';
import { EDIT_PATIENT_TITLE_ID, EditPatientDialog, EditPatientDialogData } from './components/edit-patient-dialog';
import { ReviewsList } from './components/reviews-list';
import { PatientLifecycleActions } from './patient-lifecycle-actions';
import { PatientDetailStore } from './patient-detail.store';

const SALES_PAGE_SIZE = 10;

/**
 * Ficha de paciente (S-03): encabezado + Revisiones/Ventas/Pagos. Sin equivalente en Flutter
 * (ver `docs/status.md`, 2026-11-02): esa app solo tenía diálogos sueltos desde la lista.
 * `:id` en la URL (primera ruta con parámetro de la app) + `?tab=` para la pestaña activa.
 */
@Component({
  selector: 'app-patient-detail-page',
  imports: [
    DatePipe,
    MoneyPipe,
    RouterLink,
    LucideDynamicIcon,
    Avatar,
    Badge,
    EmptyState,
    Paginator,
    ReviewsList,
    Skeleton,
    Tabs,
    OnvTable,
    TableCard,
  ],
  providers: [PatientDetailStore, PatientLifecycleActions],
  templateUrl: './patient-detail.page.html',
})
export class PatientDetailPage {
  readonly id = input.required<string>();
  readonly tab = input<string>();

  protected readonly store = inject(PatientDetailStore);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(Dialog);
  private readonly lifecycleActions = inject(PatientLifecycleActions);
  private readonly toast = inject(ToastService);

  protected readonly saleStatus = saleStatus;
  protected readonly salesPage = signal(1);
  protected readonly tabId = tabId;
  protected readonly tabPanelId = tabPanelId;
  /** Restaurar es cosa de admin+ (igual que archivar) — ver "Ver archivados" en Buscar paciente. */
  protected readonly canRestore = this.session.can('admin');

  protected readonly activeTab = computed(() => this.tab() ?? 'reviews');
  protected readonly tabs = computed<TabOption[]>(() => [
    { value: 'reviews', label: 'Revisiones', count: this.store.reviews().length },
    { value: 'sales', label: 'Ventas', count: this.store.salesTotal() },
    { value: 'payments', label: 'Pagos', count: this.store.payments().length },
  ]);

  protected readonly skeletonRows = [0, 1, 2];

  protected readonly icons = {
    back: LucideArrowLeft,
    phone: LucidePhone,
    branch: LucideMapPin,
    edit: LucideEdit,
    trash: LucideTrash2,
    restore: LucideArchiveRestore,
    view: LucideEye,
    sell: LucideShoppingCart,
    addMeasure: LucideUserPlus,
    pay: LucideHandCoins,
    notFound: LucideUserX,
  };

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => {
        void this.store.loadPatient(id);
        void this.store.loadReviews(id);
        void this.store.loadSales(id, 1, SALES_PAGE_SIZE);
        void this.store.loadPayments(id);
      });
    });
  }

  protected setTab(value: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: value === 'reviews' ? null : value },
      queryParamsHandling: 'merge',
    });
  }

  protected goToSalesPage(page: number): void {
    this.salesPage.set(page);
    void this.store.loadSales(this.id(), page, SALES_PAGE_SIZE);
  }

  protected readonly reloadReviews = (): Promise<void> => this.store.loadReviews(this.id());
  protected readonly saveReview = (review: Review) => this.store.updateReview(review);
  protected readonly removeReview = (review: Review) => this.store.deleteReview(review.id);

  protected async edit(): Promise<void> {
    const patient = this.store.patient();
    if (!patient) return;
    const data: EditPatientDialogData = { patient, save: (updated) => this.store.update(updated) };
    const ref = this.dialog.open<boolean>(EditPatientDialog, {
      data,
      role: 'dialog',
      ariaLabelledBy: EDIT_PATIENT_TITLE_ID,
      disableClose: true,
      backdropClass: ['bg-overlay'],
    });
    if (await firstValueFrom(ref.closed, { defaultValue: false })) {
      this.toast.show({ tone: 'success', title: 'Paciente actualizado', text: patient.name });
    }
  }

  protected async addMeasure(): Promise<void> {
    const patient = this.store.patient();
    if (!patient) return;
    const data: AddReviewDialogData = { patient, save: (review) => this.store.createReview(review) };
    const ref = this.dialog.open<boolean>(AddReviewDialog, {
      data,
      role: 'dialog',
      ariaLabelledBy: ADD_REVIEW_TITLE_ID,
      disableClose: true,
      backdropClass: ['bg-overlay'],
    });
    if (await firstValueFrom(ref.closed, { defaultValue: false })) {
      this.toast.show({ tone: 'success', title: 'Medida agregada', text: patient.name });
      await this.reloadReviews();
    }
  }

  protected async askDelete(): Promise<void> {
    const patient = this.store.patient();
    if (!patient) return;
    await this.lifecycleActions.askDelete(patient, this.store, () => {
      void this.router.navigate(['/dashboard/search-patient']);
    });
  }

  /** Paciente archivado: se queda en la ficha y la insignia/los botones vuelven a lo normal. */
  protected async restorePatient(): Promise<void> {
    const patient = this.store.patient();
    if (!patient) return;
    await this.lifecycleActions.askRestore(patient, this.store, () => {
      void this.store.loadPatient(this.id());
    });
  }

  protected async viewSaleDetails(sale: Sale): Promise<void> {
    const [itemsResult, paymentsResult] = await Promise.all([
      this.store.loadSaleItems(sale.folio),
      this.store.loadSalePayments(sale.id),
    ]);
    if (!itemsResult.ok) {
      this.toast.show({ tone: 'danger', title: 'No se pudo cargar el detalle', text: itemsResult.error.message });
      return;
    }

    const data: SaleDetailsDialogData = {
      sale,
      items: itemsResult.value,
      payments: paymentsResult.ok ? paymentsResult.value : [],
    };
    const ref = this.dialog.open<SaleDetailsResult>(SaleDetailsDialog, {
      data,
      role: 'dialog',
      ariaLabelledBy: SALE_DETAILS_TITLE_ID,
      backdropClass: ['bg-overlay'],
    });
    ref.closed.subscribe((result) => {
      if (result === 'pay') this.registerPayment(sale);
    });
  }

  protected registerPayment(sale: Sale): void {
    const data: RegisterPaymentDialogData = {
      sale,
      save: (draft: NewPayment) => this.store.registerPayment(sale, draft, this.session.profile()?.id ?? ''),
    };
    const ref = this.dialog.open<boolean>(RegisterPaymentDialog, {
      data,
      role: 'dialog',
      ariaLabelledBy: REGISTER_PAYMENT_TITLE_ID,
      disableClose: true,
      backdropClass: ['bg-overlay'],
    });
    ref.closed.subscribe((saved) => {
      if (saved) {
        this.toast.show({ tone: 'success', title: 'Abono registrado', text: sale.patientName });
        void this.store.loadSales(this.id(), this.salesPage(), SALES_PAGE_SIZE);
        void this.store.loadPayments(this.id());
      }
    });
  }
}
