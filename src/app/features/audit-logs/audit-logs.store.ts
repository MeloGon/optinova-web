import { Injectable, computed, inject, signal } from '@angular/core';
import { AuditLog, AuditLogStats } from '../../core/models/audit-log';
import { AuditLogRepository, AuditLogSearch } from '../../core/repositories/audit-log.repository';

interface AuditLogsState {
  items: AuditLog[];
  total: number;
  stats: AuditLogStats | null;
  loading: boolean;
  /** Mensaje para el usuario; null si no hay error. */
  error: string | null;
  /** Falso hasta que llega la primera respuesta: distingue "cargando" de "sin registros". */
  loaded: boolean;
}

/**
 * Estado de Settings · Auditoría: de solo lectura (nadie edita ni borra un registro a mano,
 * el cron del cambio #17 es el único que limpia). Se provee en la página (providers: [AuditLogsStore]).
 */
@Injectable()
export class AuditLogsStore {
  private readonly repo = inject(AuditLogRepository);

  private readonly state = signal<AuditLogsState>({
    items: [],
    total: 0,
    stats: null,
    loading: false,
    error: null,
    loaded: false,
  });

  readonly items = computed(() => this.state().items);
  readonly total = computed(() => this.state().total);
  readonly stats = computed(() => this.state().stats);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly loaded = computed(() => this.state().loaded);

  /** Número de la última búsqueda lanzada: una respuesta vieja no pisa a una más nueva. */
  private lastRequest = 0;

  async load(search: AuditLogSearch): Promise<void> {
    const request = ++this.lastRequest;
    this.state.update((s) => ({ ...s, loading: true, error: null }));

    const [page, stats] = await Promise.all([this.repo.search(search), this.repo.stats()]);
    if (request !== this.lastRequest) return;

    if (!page.ok) {
      this.state.update((s) => ({ ...s, loading: false, error: page.error.message, loaded: true }));
      return;
    }
    this.state.update((s) => ({
      ...s,
      items: page.value.items,
      total: page.value.total,
      stats: stats.ok ? stats.value : s.stats,
      loading: false,
      loaded: true,
    }));
  }
}
