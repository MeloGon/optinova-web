import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router } from '@angular/router';
import {
  LucideBanknote,
  LucideDynamicIcon,
  LucideReceipt,
  LucideRefreshCw,
  LucideScale,
  LucideTriangleAlert,
  LucideTrendingDown,
  LucideTrendingUp,
} from '@lucide/angular';
import { SessionStore } from '../../core/auth/session.store';
import { ConfigService } from '../../core/config/config.service';
import { ExpenseDateRangeSearch } from '../../core/repositories/expense.repository';
import { PaymentDateRangeSearch } from '../../core/repositories/payment.repository';
import { MONTH_OPTIONS, monthRange, toMonth, today, yearOptions } from '../../shared/utils/month';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { Badge } from '../../shared/ui/badge/badge';
import { DatePicker } from '../../shared/ui/date-picker/date-picker';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Paginator } from '../../shared/ui/paginator/paginator';
import { Segmented, SegmentedOption } from '../../shared/ui/segmented/segmented';
import { OnvTable, TableCard } from '../../shared/ui/table/table';
import { PaymentsReportStore } from './payments-report.store';

type ReportPeriod = 'day' | 'month' | 'range';
const SECTION_PAGE_SIZE = 10;

function toPeriod(value: string | undefined): ReportPeriod {
  return value === 'month' || value === 'range' ? value : 'day';
}

/** Página, cortada en memoria: ya se trajo el período completo, no hace falta otra consulta. */
function paginate<T>(items: T[], page: number): T[] {
  const from = (page - 1) * SECTION_PAGE_SIZE;
  return items.slice(from, from + SECTION_PAGE_SIZE);
}

/**
 * Settings · Ingresos y egresos (sin pantalla equivalente directa en Flutter: ahí repite la
 * misma tarjeta de métricas 3 veces y sin paginar ninguna tabla; acá cada sección reutiliza
 * C-11 Badge para los montos por método/categoría y pagina su detalle en memoria, igual criterio
 * que el resto de los reportes nuevos). Supervisor ve solo su sucursal, sin selector (mismo
 * criterio de privacidad que el Dashboard); admin/megadmin elige o ve todas. URL guarda el
 * filtro (?period=&day=&month=&from=&to=&branch=).
 */
@Component({
  selector: 'app-payments-report-page',
  imports: [ReactiveFormsModule, MoneyPipe, LucideDynamicIcon, Badge, DatePicker, EmptyState, Paginator, Segmented, OnvTable, TableCard],
  providers: [PaymentsReportStore],
  templateUrl: './payments-report.page.html',
})
export class PaymentsReportPage {
  readonly period = input<string>();
  readonly day = input<string>();
  readonly month = input<string>();
  readonly from = input<string>();
  readonly to = input<string>();
  readonly branch = input<string>();

  protected readonly store = inject(PaymentsReportStore);
  private readonly session = inject(SessionStore);
  private readonly config = inject(ConfigService).config;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** = el alcance por rol del Dashboard: supervisor solo ve su sucursal, sin poder elegir otra. */
  protected readonly scopedBranch = computed(() => {
    const profile = this.session.profile();
    return profile?.role === 'supervisor' ? profile.branch : null;
  });
  protected readonly branches = computed(() => this.config().branches);

  protected readonly periodType = computed(() => toPeriod(this.period()));
  protected readonly dayValue = computed(() => this.day() || today());
  protected readonly monthValue = computed(() => toMonth(this.month()));
  protected readonly selectedMonth = computed(() => this.monthValue().split('-')[1]);
  protected readonly selectedYear = computed(() => this.monthValue().split('-')[0]);
  protected readonly selectedYearNumber = computed(() => Number(this.selectedYear()));
  protected readonly rangeFrom = computed(() => this.from() || today());
  protected readonly rangeTo = computed(() => {
    const to = this.to() || today();
    return to < this.rangeFrom() ? this.rangeFrom() : to;
  });

  protected readonly periodOptions: SegmentedOption[] = [
    { value: 'day', label: 'Día' },
    { value: 'month', label: 'Mes' },
    { value: 'range', label: 'Rango' },
  ];
  protected readonly monthOptions = MONTH_OPTIONS;
  protected readonly yearOptions = yearOptions();

  protected readonly search = computed<PaymentDateRangeSearch & ExpenseDateRangeSearch>(() => {
    const period = this.periodType();
    const range =
      period === 'day'
        ? { from: this.dayValue(), to: this.dayValue() }
        : period === 'month'
          ? monthRange(this.monthValue())
          : { from: this.rangeFrom(), to: this.rangeTo() };
    return { ...range, branch: this.scopedBranch() ?? (this.branch() || null) };
  });

  protected readonly periodControl = new FormControl<ReportPeriod>('day', { nonNullable: true });
  protected readonly dayControl = new FormControl('', { nonNullable: true });
  protected readonly rangeStartControl = new FormControl('', { nonNullable: true });
  protected readonly rangeEndControl = new FormControl('', { nonNullable: true });

  protected readonly icons = {
    income: LucideTrendingUp,
    expenses: LucideTrendingDown,
    net: LucideScale,
    receipt: LucideReceipt,
    alert: LucideTriangleAlert,
    retry: LucideRefreshCw,
    banknote: LucideBanknote,
  };

  // Paginación en memoria de cada sección: ya se trajo el período completo (ver la store).
  // Estado local, no en la URL: son 3 tablas en una sola página, no la navegación principal.
  protected readonly newSalesPage = signal(1);
  protected readonly balancePaymentsPage = signal(1);
  protected readonly expensesPage = signal(1);

  protected readonly pagedNewSales = computed(() => paginate(this.store.newSales(), this.newSalesPage()));
  protected readonly pagedBalancePayments = computed(() => paginate(this.store.balancePayments(), this.balancePaymentsPage()));
  protected readonly pagedExpenses = computed(() => paginate(this.store.expenses(), this.expensesPage()));

  constructor() {
    effect(() => {
      const search = this.search();
      untracked(() => {
        void this.store.load(search);
        this.newSalesPage.set(1);
        this.balancePaymentsPage.set(1);
        this.expensesPage.set(1);
      });
    });

    effect(() => {
      const period = this.periodType();
      untracked(() => this.periodControl.setValue(period, { emitEvent: false }));
    });
    this.periodControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (value !== this.periodType()) void this.navigate({ period: value === 'day' ? null : value });
    });

    effect(() => {
      const day = this.dayValue();
      untracked(() => this.dayControl.setValue(day, { emitEvent: false }));
    });
    this.dayControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (value && value !== this.dayValue()) void this.navigate({ day: value });
    });

    effect(() => {
      const from = this.rangeFrom();
      untracked(() => this.rangeStartControl.setValue(from, { emitEvent: false }));
    });
    this.rangeStartControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (value && value !== this.rangeFrom()) void this.navigate({ from: value });
    });

    effect(() => {
      const to = this.rangeTo();
      untracked(() => this.rangeEndControl.setValue(to, { emitEvent: false }));
    });
    this.rangeEndControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (value && value !== this.rangeTo()) void this.navigate({ to: value });
    });
  }

  protected setMonth(monthNumber: string): void {
    void this.navigate({ month: `${this.selectedYear()}-${monthNumber}` });
  }

  protected setYear(year: string): void {
    void this.navigate({ month: `${year}-${this.selectedMonth()}` });
  }

  protected setBranch(value: string): void {
    void this.navigate({ branch: value || null });
  }

  protected retry(): void {
    void this.store.load(this.search());
  }

  protected readonly sectionPageSize = SECTION_PAGE_SIZE;

  private navigate(queryParams: Params): Promise<boolean> {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
