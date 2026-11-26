import { Dialog } from '@angular/cdk/dialog';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router } from '@angular/router';
import {
  LucideCalendar,
  LucideCalendarClock,
  LucideDynamicIcon,
  LucideEllipsis,
  LucideEye,
  LucideHandCoins,
  LucideHash,
  LucideMapPin,
  LucidePlus,
  LucidePrinter,
  LucideReceipt,
  LucideRefreshCw,
  LucideSearch,
  LucideTag,
  LucideTrash2,
  LucideTriangleAlert,
  LucideUser,
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
import { TableCard } from '../../shared/ui/table/table';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ConfirmService } from '../../shared/ui/dialog/confirm.service';
import {
  SUPERVISOR_AUTH_TITLE_ID,
  SupervisorAuthDialog,
  SupervisorAuthDialogData,
} from '../../shared/ui/supervisor-auth-dialog/supervisor-auth-dialog';
import { ReceiptPdfService, saleItemToReceiptLine } from '../../shared/services/receipt-pdf.service';
import { Badge, BadgeTone } from '../../shared/ui/badge/badge';
import { ChangeDateDialog, ChangeDateDialogData, CHANGE_DATE_TITLE_ID } from './components/change-date-dialog';
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
 * (?q=&branch=&seller=&date=&status=&page=&size=), igual criterio que Buscar paciente y Egresos.
 */
@Component({
  selector: 'app-sales-history-page',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    NgTemplateOutlet,
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
    TableCard,
  ],
  providers: [SalesHistoryStore],
  templateUrl: './sales-history.page.html',
})
export class SalesHistoryPage {
  readonly q = input<string>();
  readonly branch = input<string>();
  readonly seller = input<string>();
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
  private readonly confirm = inject(ConfirmService);
  private readonly receiptPdf = inject(ReceiptPdfService);
  protected readonly printingReceiptFor = signal<string | null>(null);

  protected readonly branches = computed(() => this.config().branches);
  protected readonly saleStatus = saleStatus;

  /**
   * "Cambiar fecha" exige DOS cosas: el apagado de emergencia de `app_config` (admin+, toda la
   * empresa) y, si quien mira es vendedor, su propio permiso otorgado por su supervisor
   * (`perfiles.puede_cambiar_fecha`, Settings · Features). Supervisor o superior siempre puede.
   */
  protected readonly canChangeDate = computed(() => {
    if (!this.store.changeDateEnabled()) return false;
    const profile = this.session.profile();
    if (!profile) return false;
    return profile.role !== 'vendedor' || profile.canChangeDate;
  });

  protected readonly search = computed<SaleSearch>(() => ({
    query: (this.q() ?? '').trim(),
    branch: this.branch() || null,
    seller: this.seller() || null,
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
    print: LucidePrinter,
    changeDate: LucideCalendarClock,
    calendar: LucideCalendar,
    user: LucideUser,
    tag: LucideTag,
    hash: LucideHash,
    pin: LucideMapPin,
    plus: LucidePlus,
    trash: LucideTrash2,
  };

  /** Fondo y color del ícono de estado de cada fila (mismos tonos que el badge). */
  protected readonly statusIconClass: Partial<Record<BadgeTone, string>> = {
    success: 'bg-success-subtle text-success-subtle-foreground',
    warning: 'bg-warning-subtle text-warning-subtle-foreground',
    info: 'bg-info-subtle text-info-subtle-foreground',
  };

  /** Porcentaje abonado (0–100); sin total se toma como pagada. */
  protected paidPercent(sale: Sale): number {
    if (sale.totalWithDiscount <= 0) return 100;
    return Math.round(Math.min(Math.max(sale.account / sale.totalWithDiscount, 0), 1) * 100);
  }

  /** Clic en el folio: lo copia al portapapeles (como en el Flutter anterior). */
  protected async copyFolio(folio: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(folio);
      this.toast.show({ tone: 'success', title: `Folio ${folio} copiado` });
    } catch {
      this.toast.show({ tone: 'danger', title: 'No se pudo copiar el folio' });
    }
  }

  constructor() {
    void this.store.loadChangeDateFlag();
    void this.store.loadSellers();

    effect(() => {
      const search = this.search();
      untracked(() => void this.store.load(search));
    });

    effect(() => {
      // Solo depende de `q()`, no de `search()` entero (hallazgo de Antigravity, 2026-11-04).
      const query = (this.q() ?? '').trim();
      untracked(() => {
        if (this.text.value !== query) this.text.setValue(query);
      });
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

  protected setSeller(value: string): void {
    void this.navigate({ seller: value || null, page: null });
  }

  protected clearFilters(): void {
    this.text.setValue('');
    void this.navigate({ q: null, branch: null, seller: null, date: null, page: null });
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

  /** = "Imprimir recibo" del menú ⋯ de Flutter: recarga el detalle y genera el mismo ticket 80mm. */
  protected async printReceipt(sale: Sale): Promise<void> {
    this.printingReceiptFor.set(sale.id);
    const itemsResult = await this.store.loadItems(sale.folio);
    if (!itemsResult.ok) {
      this.printingReceiptFor.set(null);
      this.toast.show({ tone: 'danger', title: 'No se pudo generar el recibo', text: itemsResult.error.message });
      return;
    }
    try {
      await this.receiptPdf.print(sale, itemsResult.value.map(saleItemToReceiptLine));
    } finally {
      this.printingReceiptFor.set(null);
    }
  }

  protected registerPayment(sale: Sale): void {
    const data: RegisterPaymentDialogData = {
      sale,
      save: (draft) => this.store.registerPayment(draft),
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

  protected changeDate(sale: Sale): void {
    const data: ChangeDateDialogData = {
      folio: sale.folio,
      currentDate: sale.date,
      save: (newDate) => this.store.changeDate(sale, newDate, this.session.profile()?.email ?? ''),
    };
    const ref = this.dialog.open<boolean>(ChangeDateDialog, {
      data,
      role: 'dialog',
      ariaLabelledBy: CHANGE_DATE_TITLE_ID,
      disableClose: true,
      backdropClass: ['bg-overlay'],
    });
    ref.closed.subscribe((saved) => {
      if (saved) this.toast.show({ tone: 'success', title: 'Fecha actualizada' });
    });
  }

  /**
   * Eliminar venta: supervisor+ confirma y listo; un vendedor necesita correo y contraseña de un
   * supervisor (P-04, mismo diálogo que descuentos y pacientes). Quién puede lo decide el servidor
   * (`delete-sale`); aquí solo se elige qué diálogo mostrar.
   */
  protected async askDelete(sale: Sale): Promise<void> {
    const label = `${sale.folio || 'sin folio'} · ${sale.patientName || 'sin paciente'}`;
    const consequences =
      'Se borran sus productos y abonos, los armazones vuelven al stock y queda registrado en Auditoría. No se puede deshacer.';

    if (!this.session.can('supervisor')) {
      const data: SupervisorAuthDialogData = {
        description: `Eliminar la venta ${label}. ${consequences}`,
        confirmLabel: 'Autorizar y eliminar',
        authorize: (email, password) => this.store.deleteSale(sale, { email, password }),
      };
      const ref = this.dialog.open<boolean>(SupervisorAuthDialog, {
        data,
        role: 'dialog',
        ariaLabelledBy: SUPERVISOR_AUTH_TITLE_ID,
        disableClose: true,
        backdropClass: ['bg-overlay'],
      });
      ref.closed.subscribe((deleted) => {
        if (deleted) this.toast.show({ tone: 'success', title: 'Venta eliminada', text: label });
      });
      return;
    }

    const confirmed = await this.confirm.confirm({
      title: '¿Eliminar esta venta?',
      text: `${label}. ${consequences}`,
      confirmLabel: 'Eliminar venta',
    });
    if (!confirmed) return;

    const result = await this.store.deleteSale(sale);
    if (result.ok) this.toast.show({ tone: 'success', title: 'Venta eliminada', text: label });
    else this.toast.show({ tone: 'danger', title: 'No se pudo eliminar la venta', text: result.error.message });
  }

  private navigate(queryParams: Params): Promise<boolean> {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
