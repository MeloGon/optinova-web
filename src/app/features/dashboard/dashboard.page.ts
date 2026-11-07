import { Dialog } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  LucideDynamicIcon,
  LucideHandCoins,
  LucideReceipt,
  LucideRefreshCw,
  LucideScanEye,
  LucideSearch,
  LucideShieldCheck,
  LucideShoppingCart,
  LucideTriangleAlert,
  LucideUsers,
  LucideWallet,
} from '@lucide/angular';
import { SessionStore } from '../../core/auth/session.store';
import { ConfigService } from '../../core/config/config.service';
import { DashboardPeriod } from '../../core/models/dashboard';
import { Sale } from '../../core/models/sale';
import { MoneyPipe, formatMoney } from '../../shared/pipes/money.pipe';
import { Badge } from '../../shared/ui/badge/badge';
import { BarChart, BarDatum } from '../../shared/ui/charts/bar-chart';
import { DonutChart, DonutSlice } from '../../shared/ui/charts/donut-chart';
import { RankBars, RankItem } from '../../shared/ui/charts/rank-bars';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Segmented } from '../../shared/ui/segmented/segmented';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { StatCard } from '../../shared/ui/stat-card/stat-card';
import { ToastService } from '../../shared/ui/toast/toast.service';
import {
  RegisterPaymentDialog,
  RegisterPaymentDialogData,
  REGISTER_PAYMENT_TITLE_ID,
} from '../sales-history/components/register-payment-dialog';
import {
  BUCKET_META,
  COMPARE_LABEL,
  PERIOD_NOUN,
  PERIOD_OF,
  PERIOD_OPTIONS,
  ageLabel,
  ageTone,
  capitalize,
  mountName,
  stockLabel,
  stockTone,
  describeActivity,
  firstName,
  greeting,
  scopeLabel,
  variation,
} from './dashboard-format';
import { DashboardStore } from './dashboard.store';

const DAY_LABEL = new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric' });

/**
 * Dashboard (S-02). Lo que se dibuja depende de lo que el servidor devolvió para el rol:
 * un campo `null` en el resumen = "este rol no lo ve" y su tarjeta no existe en la página.
 * Ocultar es solo presentación; el que impide pedir el dato es `dashboard_summary()` en la DB.
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [
    DatePipe,
    RouterLink,
    ReactiveFormsModule,
    LucideDynamicIcon,
    MoneyPipe,
    Badge,
    BarChart,
    DonutChart,
    RankBars,
    EmptyState,
    Segmented,
    Skeleton,
    StatCard,
  ],
  providers: [DashboardStore],
  templateUrl: './dashboard.page.html',
})
export class DashboardPage {
  protected readonly store = inject(DashboardStore);
  private readonly session = inject(SessionStore);
  private readonly config = inject(ConfigService).config;
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);

  protected readonly ageLabel = ageLabel;
  protected readonly ageTone = ageTone;
  protected readonly mountName = mountName;
  protected readonly stockLabel = stockLabel;
  protected readonly stockTone = stockTone;

  protected readonly icons = {
    cart: LucideShoppingCart,
    income: LucideHandCoins,
    patients: LucideUsers,
    receivable: LucideReceipt,
    expenses: LucideWallet,
    stock: LucideScanEye,
    search: LucideSearch,
    activity: LucideShieldCheck,
    retry: LucideRefreshCw,
    warning: LucideTriangleAlert,
  };

  protected readonly periodOptions = PERIOD_OPTIONS;
  protected readonly period = new FormControl<string>(this.store.period(), { nonNullable: true });

  /** Qué lista del "más vendido" se ve: armazones (marca + modelo) o solo marcas. Solo cambia la vista. */
  protected readonly topOptions = [
    { value: 'models', label: 'Armazones' },
    { value: 'brands', label: 'Marcas' },
  ];
  protected readonly topMode = new FormControl<string>('models', { nonNullable: true });
  private readonly topModeValue = toSignal(this.topMode.valueChanges, { initialValue: this.topMode.value });

  /** Solo admin o superior ve la auditoría y puede filtrar por sucursal (el servidor lo vuelve a comprobar). */
  protected readonly isAdmin = computed(() => this.session.can('admin'));

  /** Todas, también la cerrada: tiene ventas históricas que un admin puede querer filtrar. */
  protected readonly branches = computed(() => this.config().branches);

  protected readonly greeting = computed(() => {
    const name = firstName(this.session.profile()?.name);
    const hello = greeting(new Date(), this.config().timeZone);
    return name ? `${hello}, ${name}` : hello;
  });

  protected readonly scope = computed(() => {
    const s = this.store.summary();
    return s ? scopeLabel(s.scope, s.branch) : '';
  });

  protected readonly fmtMoney = (n: number): string => formatMoney(n, this.config().currency);

  /** Periodo de los datos que se ven (no el elegido): evita rotular mal mientras llega la respuesta. */
  private readonly shown = computed<DashboardPeriod>(() => this.store.summary()?.period ?? this.store.period());

  protected readonly compareLabel = computed(() => COMPARE_LABEL[this.shown()]);
  protected readonly periodNoun = computed(() => PERIOD_NOUN[this.shown()]);
  protected readonly methodsTitle = computed(() => `Métodos de pago ${PERIOD_OF[this.shown()]}`);
  protected readonly chartTitle = computed(() =>
    this.shown() === 'month' ? 'Ventas del mes' : 'Ventas de los últimos 7 días',
  );

  protected readonly mySales = computed(() => this.store.summary()?.kpis.mySales ?? null);
  protected readonly income = computed(() => this.store.summary()?.kpis.income ?? null);

  protected readonly mySalesVariation = computed(() => {
    const k = this.mySales();
    return k ? variation(k.total, k.previousTotal) : null;
  });
  protected readonly incomeVariation = computed(() => {
    const k = this.income();
    return k ? variation(k.total, k.previousTotal) : null;
  });

  protected readonly mySalesSeries = computed(() => this.mySales()?.series.map((p) => p.total) ?? []);
  protected readonly incomeSeries = computed(() => this.income()?.series.map((p) => p.total) ?? []);

  protected readonly chartBars = computed<BarDatum[]>(() => {
    const days = this.store.summary()?.salesByDay ?? [];
    return days.map((d, i) => ({
      label:
        i === days.length - 1
          ? 'Hoy'
          : days.length > 7
            ? String(Number(d.date.slice(8)))
            : DAY_LABEL.format(new Date(`${d.date}T00:00:00`)),
      value: d.total,
    }));
  });

  /** Los tres tramos de antigüedad con su rótulo, color y qué parte del saldo total son. */
  protected readonly collectionBuckets = computed(() => {
    const c = this.store.summary()?.collections;
    if (!c) return [];
    return c.buckets.map((b) => ({
      ...b,
      ...BUCKET_META[b.key],
      percent: c.total > 0 ? Math.round((b.total / c.total) * 100) : 0,
    }));
  });

  /** "noviembre": el top y el ranking miran el mes en curso, sea cual sea el periodo elegido. */
  protected readonly monthName = computed(() => {
    const today = this.store.summary()?.today;
    return today ? new Intl.DateTimeFormat('es', { month: 'long' }).format(new Date(`${today}T00:00:00`)) : '';
  });

  protected readonly topItems = computed<RankItem[]>(() => {
    const top = this.store.summary()?.topProducts;
    const list = (this.topModeValue() === 'brands' ? top?.brands : top?.models) ?? [];
    return list.map((p) => ({
      label: p.name,
      value: p.units,
      valueLabel: `${p.units} ${p.units === 1 ? 'unidad' : 'unidades'}`,
      hint: this.fmtMoney(p.total),
    }));
  });

  protected readonly sellerItems = computed<RankItem[]>(() =>
    (this.store.summary()?.sellerRanking ?? []).map((s) => ({
      label: s.name,
      value: s.total,
      valueLabel: this.fmtMoney(s.total),
      hint: this.sales(s.count),
    })),
  );

  protected readonly paymentSlices = computed<DonutSlice[]>(() =>
    (this.store.summary()?.paymentMethods ?? []).map((m) => ({
      label: this.methodLabel(m.method),
      value: m.total,
    })),
  );

  protected readonly expenseSlices = computed<DonutSlice[]>(() =>
    (this.store.summary()?.expensesMonth ?? []).map((c) => ({
      label: c.category,
      value: c.total,
      color: c.color,
    })),
  );

  protected readonly activityLines = computed(() =>
    this.store.activity().map((a) => ({
      text: describeActivity(a, this.fmtMoney),
      createdAt: a.createdAt,
    })),
  );

  constructor() {
    void this.store.load();
    if (this.isAdmin()) void this.store.loadActivity();

    this.period.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => void this.store.setPeriod(value as DashboardPeriod));
  }

  protected onBranch(value: string): void {
    void this.store.setBranch(value || null);
  }

  protected retry(): void {
    void this.store.load();
    if (this.isAdmin()) void this.store.loadActivity();
  }

  /** "Cobrar" en la cobranza: abre el mismo diálogo de abono de Historial de ventas. */
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

  protected sales(count: number): string {
    return `${count} ${count === 1 ? 'venta' : 'ventas'}`;
  }

  private methodLabel(method: string): string {
    return this.config().paymentMethods.find((p) => p.value === method)?.label ?? capitalize(method);
  }
}
