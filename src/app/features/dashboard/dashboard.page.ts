import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideDynamicIcon,
  LucideHandCoins,
  LucideReceipt,
  LucideRefreshCw,
  LucideSearch,
  LucideShieldCheck,
  LucideShoppingCart,
  LucideTriangleAlert,
  LucideUsers,
  LucideWallet,
} from '@lucide/angular';
import { SessionStore } from '../../core/auth/session.store';
import { ConfigService } from '../../core/config/config.service';
import { MoneyPipe, formatMoney } from '../../shared/pipes/money.pipe';
import { Badge } from '../../shared/ui/badge/badge';
import { BarChart, BarDatum } from '../../shared/ui/charts/bar-chart';
import { DonutChart, DonutSlice } from '../../shared/ui/charts/donut-chart';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { capitalize, describeActivity, firstName, greeting, scopeLabel } from './dashboard-format';
import { DashboardStore } from './dashboard.store';

const DAY_LABEL = new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric' });

/**
 * Dashboard (S-02). Lo que se dibuja depende de lo que el servidor devolvió para el rol:
 * un campo `null` en el resumen = "este rol no lo ve" y su tarjeta no existe en la página.
 * Ocultar es solo presentación; el que impide pedir el dato es `dashboard_summary()` en la DB.
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [DatePipe, RouterLink, LucideDynamicIcon, MoneyPipe, Badge, BarChart, DonutChart, EmptyState, Skeleton],
  providers: [DashboardStore],
  templateUrl: './dashboard.page.html',
})
export class DashboardPage {
  protected readonly store = inject(DashboardStore);
  private readonly session = inject(SessionStore);
  private readonly config = inject(ConfigService).config;

  protected readonly icons = {
    cart: LucideShoppingCart,
    income: LucideHandCoins,
    patients: LucideUsers,
    receivable: LucideReceipt,
    expenses: LucideWallet,
    search: LucideSearch,
    activity: LucideShieldCheck,
    retry: LucideRefreshCw,
    warning: LucideTriangleAlert,
  };

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

  protected readonly weekBars = computed<BarDatum[]>(() => {
    const days = this.store.summary()?.salesByDay ?? [];
    return days.map((d, i) => ({
      label: i === days.length - 1 ? 'Hoy' : DAY_LABEL.format(new Date(`${d.date}T00:00:00`)),
      value: d.total,
    }));
  });

  protected readonly weekTotal = this.store.weekTotal;

  protected readonly weekCount = computed(
    () => this.store.summary()?.salesByDay.reduce((sum, d) => sum + d.count, 0) ?? 0,
  );

  protected readonly paymentSlices = computed<DonutSlice[]>(() =>
    (this.store.summary()?.paymentMethodsToday ?? []).map((m) => ({
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
    void this.store.loadSummary(null);
    if (this.isAdmin()) void this.store.loadActivity();
  }

  protected onBranch(value: string): void {
    void this.store.loadSummary(value || null);
  }

  protected retry(): void {
    void this.store.loadSummary(null);
    if (this.isAdmin()) void this.store.loadActivity();
  }

  private methodLabel(method: string): string {
    return this.config().paymentMethods.find((p) => p.value === method)?.label ?? capitalize(method);
  }
}
