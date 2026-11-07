import { Injectable, computed, inject, signal } from '@angular/core';
import { AppError } from '../../core/errors/app-error';
import { ActivityEntry, DashboardPeriod, DashboardSummary } from '../../core/models/dashboard';
import { DashboardRepository } from '../../core/repositories/dashboard.repository';
import { NewPayment } from '../../core/repositories/payment.repository';
import { Result } from '../../core/result';
import { SalePaymentService } from '../../core/services/sale-payment.service';

interface DashboardState {
  summary: DashboardSummary | null;
  loading: boolean;
  /** Mensaje para el usuario; null si no hay error. */
  error: string | null;
  activity: ActivityEntry[];
  activityLoaded: boolean;
  activityError: string | null;
}

/**
 * Estado del dashboard (= DashboardProvider de Flutter, con una sola llamada en vez de cinco:
 * el servidor ya devuelve el resumen filtrado por el rol del usuario).
 * Se provee en la página (providers: [DashboardStore]): nace y muere con ella.
 */
@Injectable()
export class DashboardStore {
  private readonly repo = inject(DashboardRepository);
  private readonly salePayments = inject(SalePaymentService);

  private readonly state = signal<DashboardState>({
    summary: null,
    loading: false,
    error: null,
    activity: [],
    activityLoaded: false,
    activityError: null,
  });

  private readonly periodState = signal<DashboardPeriod>('today');
  private readonly branchState = signal<string | null>(null);

  /** Periodo elegido; empieza en "hoy" (lo primero que mira quien abre el dashboard). */
  readonly period = this.periodState.asReadonly();
  /** Sucursal elegida (solo admin o superior; `null` = todas). */
  readonly branch = this.branchState.asReadonly();

  readonly summary = computed(() => this.state().summary);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly activity = computed(() => this.state().activity);
  readonly activityLoaded = computed(() => this.state().activityLoaded);
  readonly activityError = computed(() => this.state().activityError);

  /** Falso hasta que llega la primera respuesta: distingue "cargando" de "error". */
  readonly loaded = computed(() => this.state().summary !== null || this.state().error !== null);

  /** Ventas y total de lo que muestra la gráfica de barras. */
  readonly chartTotal = computed(
    () => this.state().summary?.salesByDay.reduce((sum, d) => sum + d.total, 0) ?? 0,
  );
  readonly chartCount = computed(
    () => this.state().summary?.salesByDay.reduce((sum, d) => sum + d.count, 0) ?? 0,
  );

  /** Número de la última carga: una respuesta vieja no pisa a una más nueva. */
  private lastRequest = 0;

  /** Pide el resumen con la sucursal y el periodo actuales. */
  async load(): Promise<void> {
    const request = ++this.lastRequest;
    this.state.update((s) => ({ ...s, loading: true, error: null }));

    const result = await this.repo.summary(this.branchState(), this.periodState());
    if (request !== this.lastRequest) return;

    if (result.ok) {
      this.state.update((s) => ({ ...s, summary: result.value, loading: false }));
    } else {
      this.state.update((s) => ({ ...s, loading: false, error: result.error.message }));
    }
  }

  async setPeriod(period: DashboardPeriod): Promise<void> {
    if (period === this.periodState()) return;
    this.periodState.set(period);
    await this.load();
  }

  /** Solo cambia el resultado para admin o superior; el servidor lo ignora para los demás. */
  async setBranch(branch: string | null): Promise<void> {
    if (branch === this.branchState()) return;
    this.branchState.set(branch);
    await this.load();
  }

  /**
   * Registra un abono sobre una venta con saldo (abono y saldo en una sola transacción, ver
   * `SalePaymentService`) y, si salió bien, vuelve a pedir el resumen: cambian la cobranza, el saldo por cobrar y los ingresos.
   * El error lo muestra quien llama (el diálogo de abono).
   */
  async registerPayment(payment: NewPayment): Promise<Result<void, AppError>> {
    const result = await this.salePayments.register(payment);
    if (result.ok) await this.load();
    return result;
  }

  /** Solo se llama para admin o superior; el servidor la niega a los demás. */
  async loadActivity(limit = 8): Promise<void> {
    const result = await this.repo.activity(limit);
    if (result.ok) {
      this.state.update((s) => ({ ...s, activity: result.value, activityLoaded: true, activityError: null }));
    } else {
      this.state.update((s) => ({ ...s, activityLoaded: true, activityError: result.error.message }));
    }
  }
}
