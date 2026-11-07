import { Dialog } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { LucideArrowLeft, LucideDynamicIcon, LucideReceipt, LucideRefreshCw, LucideTriangleAlert } from '@lucide/angular';
import { Sale } from '../../core/models/sale';
import { PaymentRepository } from '../../core/repositories/payment.repository';
import { SaleRepository } from '../../core/repositories/sale.repository';
import { SalePaymentService } from '../../core/services/sale-payment.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Paginator } from '../../shared/ui/paginator/paginator';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { OnvTable, TableCard } from '../../shared/ui/table/table';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { RegisterPaymentDialog, RegisterPaymentDialogData, REGISTER_PAYMENT_TITLE_ID } from '../sales-history/components/register-payment-dialog';
import { SaleDetailsDialog, SaleDetailsDialogData, SaleDetailsResult, SALE_DETAILS_TITLE_ID } from '../sales-history/components/sale-details-dialog';
import { monthLabel, toMonth } from '../../shared/utils/month';
import { SellerSalesSearch, SellerSalesStore } from './seller-sales.store';

const PAGE_SIZES = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

function toPage(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

function toPageSize(value: string | undefined): number {
  const n = Number(value);
  return PAGE_SIZES.includes(n) ? n : DEFAULT_PAGE_SIZE;
}

/**
 * Detalle de las ventas de un vendedor (al presionar su nombre en Ventas por vendedor): página
 * propia con paginación real, no un diálogo — un vendedor con muchas ventas no cabe cómodo ahí,
 * ni en mobile. Cada venta sí es puntual (una sola, acotada), así que su detalle reutiliza el
 * mismo diálogo de Historial de ventas en vez de navegar a otra pantalla. URL guarda el filtro
 * (?month=&branch=&page=&size=), igual criterio que el resto de la app.
 */
@Component({
  selector: 'app-seller-sales-page',
  imports: [RouterLink, DatePipe, MoneyPipe, LucideDynamicIcon, EmptyState, Paginator, Skeleton, OnvTable, TableCard],
  providers: [SellerSalesStore],
  templateUrl: './seller-sales.page.html',
})
export class SellerSalesPage {
  readonly name = input.required<string>();
  readonly month = input<string>();
  readonly branch = input<string>();
  readonly page = input<string>();
  readonly size = input<string>();

  protected readonly store = inject(SellerSalesStore);
  private readonly saleRepo = inject(SaleRepository);
  private readonly paymentRepo = inject(PaymentRepository);
  private readonly salePayment = inject(SalePaymentService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);

  protected readonly search = computed<SellerSalesSearch>(() => ({
    sellerName: this.name(),
    month: toMonth(this.month()),
    branch: this.branch() || null,
    page: toPage(this.page()),
    pageSize: toPageSize(this.size()),
  }));

  protected readonly monthLabel = computed(() => monthLabel(this.search().month));
  protected readonly skeletonRows = Array.from({ length: 6 }, (_, i) => i);

  protected readonly icons = {
    back: LucideArrowLeft,
    receipt: LucideReceipt,
    alert: LucideTriangleAlert,
    retry: LucideRefreshCw,
  };

  constructor() {
    effect(() => {
      const search = this.search();
      untracked(() => void this.store.load(search));
    });
  }

  protected goToPage(page: number): void {
    void this.navigate({ page: page === 1 ? null : page });
  }

  protected changePageSize(size: number): void {
    void this.navigate({ size: size === DEFAULT_PAGE_SIZE ? null : size, page: null });
  }

  protected retry(): void {
    void this.store.load(this.search());
  }

  /** = "Ver detalle" de Historial de ventas: mismo diálogo, los datos se piden igual. */
  protected async viewDetails(sale: Sale): Promise<void> {
    const [itemsResult, paymentsResult] = await Promise.all([
      this.saleRepo.getItems(sale.folio),
      this.paymentRepo.listBySale(sale.id),
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

  private registerPayment(sale: Sale): void {
    const data: RegisterPaymentDialogData = {
      sale,
      save: (draft) => this.salePayment.register(draft),
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
        void this.store.load(this.search());
      }
    });
  }

  private navigate(queryParams: Params): Promise<boolean> {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
