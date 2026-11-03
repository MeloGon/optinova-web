import { Injectable, computed, inject, signal } from '@angular/core';
import { ActivityEntry, DashboardSummary } from '../../core/models/dashboard';
import { DashboardRepository } from '../../core/repositories/dashboard.repository';

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

  private readonly state = signal<DashboardState>({
    summary: null,
    loading: false,
    error: null,
    activity: [],
    activityLoaded: false,
    activityError: null,
  });

  readonly summary = computed(() => this.state().summary);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly activity = computed(() => this.state().activity);
  readonly activityLoaded = computed(() => this.state().activityLoaded);
  readonly activityError = computed(() => this.state().activityError);

  /** Falso hasta que llega la primera respuesta: distingue "cargando" de "error". */
  readonly loaded = computed(() => this.state().summary !== null || this.state().error !== null);

  /** Total vendido en los 7 días (para el título accesible y el encabezado de la gráfica). */
  readonly weekTotal = computed(
    () => this.state().summary?.salesByDay.reduce((sum, d) => sum + d.total, 0) ?? 0,
  );

  /** Número de la última carga: una respuesta vieja no pisa a una más nueva. */
  private lastRequest = 0;

  /** `branch` solo cambia el resultado para admin o superior; el servidor lo ignora para los demás. */
  async loadSummary(branch: string | null = null): Promise<void> {
    const request = ++this.lastRequest;
    this.state.update((s) => ({ ...s, loading: true, error: null }));

    const result = await this.repo.summary(branch);
    if (request !== this.lastRequest) return;

    if (result.ok) {
      this.state.update((s) => ({ ...s, summary: result.value, loading: false }));
    } else {
      this.state.update((s) => ({ ...s, loading: false, error: result.error.message }));
    }
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
