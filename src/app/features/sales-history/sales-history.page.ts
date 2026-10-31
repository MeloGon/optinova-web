import { Dialog } from '@angular/cdk/dialog';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router } from '@angular/router';
import {
  LucideDynamicIcon,
  LucideEllipsis,
  LucideEye,
  LucideHandCoins,
  LucideReceipt,
  LucideRefreshCw,
  LucideSearch,
  LucideTriangleAlert,
  LucideX,
} from '@lucide/angular';
import { SessionStore } from '../../core/auth/session.store';
import { ConfigService } from '../../core/config/config.service';
import { Sale } from '../../core/models/sale';
import { SaleSearch, SaleStatus } from '../../core/repositories/sale.repository';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { DatePicker } from '../../shared/ui/date-picker/date-picker';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Paginator } from '../../shared/ui/paginator/paginator';
import { Segmented, SegmentedOption } from '../../shared/ui/segmented/segmented';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { OnvTable, TableCard } from '../../shared/ui/table/table';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { Badge } from '../../shared/ui/badge/badge';
import { RegisterPaymentDialog, RegisterPaymentDialogData, REGISTER_PAYMENT_TITLE_ID } from './components/register-payment-dialog';
import {
  SaleDetailsDialog,
  SaleDetailsDialogData,
  SaleDetailsResult,
  SALE_DETAILS_TITLE_ID,
} from './components/sale-details-dialog';
import { saleStatus } from './sale-status';
import { SalesHistoryStore } from './sales-history.store';

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

function toStatus(value: string | undefined): SaleStatus {
  return value === 'balance' || value === 'paid' ? value : 'all';
}

/**
 * Historial de ventas (= S-05 Historial de ventas). La URL guarda el filtro
 * (?q=&branch=&date=&status=&page=&size=), igual criterio que Buscar paciente y Egresos.
 */
@Component({
  selector: 'app-sales-history-page',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    MoneyPipe,
    LucideDynamicIcon,
    CdkMenu,
    CdkMenuItem,
    CdkMenuTrigger,
    Badge,
    DatePicker,
    EmptyState,
    Paginator,
    Segmented,
    Skeleton,
    OnvTable,
    TableCard,
  ],
  providers: [SalesHistoryStore],
  templateUrl: './sales-history.page.html',
})
export class SalesHistoryPage {
  readonly q = input<string>();
  readonly branch = input<string>();
  readonly date = input<string>();
  readonly status = input<string>();
  readonly page = input<string>();
  readonly size = input<string>();

  protected readonly store = inject(SalesHistoryStore);
  private readonly session = inject(SessionStore);
  private readonly config = inject(ConfigService).config;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);

  protected readonly branches = computed(() => this.config().branches);
  protected readonly saleStatus = saleStatus;

  protected readonly search = computed<SaleSearch>(() => ({
    query: (this.q() ?? '').trim(),
    branch: this.branch() || null,
    date: this.date() || null,
    status: toStatus(this.status()),
    page: toPage(this.page()),
    pageSize: toPageSize(this.size()),
  }));

  protected readonly statusOptions = computed<SegmentedOption[]>(() => {
    const c = this.store.counts();
    return [
      { value: 'all', label: 'Todas', count: c.all },
      { value: 'balance', label: 'Con saldo', count: c.balance },
      { value: 'paid', label: 'Pagadas', count: c.paid },
    ];
  });

  /** Lo que el usuario está escribiendo; no busca hasta Enter o "Buscar". */
  protected readonly text = new FormControl('', { nonNullable: true });

  protected readonly statusControl = new FormControl<SaleStatus>('all', { nonNullable: true });
  protected readonly dateControl = new FormControl('', { nonNullable: true });

  protected readonly skeletonRows = Array.from({ length: 6 }, (_, i) => i);

  protected readonly icons = {
    search: LucideSearch,
    clear: LucideX,
    receipt: LucideReceipt,
    alert: LucideTriangleAlert,
    retry: LucideRefreshCw,
    view: LucideEye,
    more: LucideEllipsis,
    pay: LucideHandCoins,
  };

  constructor() {
    effect(() => {
      const search = this.search();
      untracked(() => void this.store.load(search));
    });

    effect(() => {
      const query = this.search().query;
      untracked(() => this.text.setValue(query));
    });

    effect(() => {
      const status = this.search().status;
      untracked(() => this.statusControl.setValue(status, { emitEvent: false }));
    });

    this.statusControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (value !== this.search().status) void this.navigate({ status: value === 'all' ? null : value, page: null });
    });

    effect(() => {
      const date = this.search().date ?? '';
      untracked(() => this.dateControl.setValue(date, { emitEvent: false }));
    });

    this.dateControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (value !== (this.search().date ?? '')) void this.navigate({ date: value || null, page: null });
    });

    effect(() => {
      const { page, pageSize } = this.search();
      const lastPage = Math.ceil(this.store.total() / pageSize);
      const outOfRange =
        this.store.loaded() && !this.store.loading() && this.store.total() > 0 && page > lastPage;
      if (outOfRange) untracked(() => void this.navigate({ page: lastPage === 1 ? null : lastPage }));
    });
  }

  protected submit(): void {
    const query = this.text.value.trim();
    const current = this.search();
    if (query === current.query && current.page === 1) {
      void this.store.load(current);
      return;
    }
    void this.navigate({ q: query || null, page: null });
  }

  protected clearSearch(): void {
    this.text.setValue('');
    this.submit();
  }

  protected setBranch(value: string): void {
    void this.navigate({ branch: value || null, page: null });
  }

  protected clearFilters(): void {
    this.text.setValue('');
    void this.navigate({ q: null, branch: null, date: null, page: null });
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

  protected async viewDetails(sale: Sale): Promise<void> {
    const [itemsResult, paymentsResult] = await Promise.all([
      this.store.loadItems(sale.folio),
      this.store.loadPayments(sale.id),
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
      save: (draft) => this.store.registerPayment(sale, draft, this.session.profile()?.id ?? ''),
    };
    const ref = this.dialog.open<boolean>(RegisterPaymentDialog, {
      data,
      role: 'dialog',
      ariaLabelledBy: REGISTER_PAYMENT_TITLE_ID,
      disableClose: true,
      backdropClass: ['bg-overlay'],
    });
    ref.closed.subscribe((saved) => {
      if (saved) this.toast.show({ tone: 'success', title: 'Abono registrado', text: sale.patientName });
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
