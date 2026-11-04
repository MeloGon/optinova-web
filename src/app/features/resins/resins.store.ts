import { Injectable, computed, inject, signal } from '@angular/core';
import { AppError } from '../../core/errors/app-error';
import { Resin } from '../../core/models/resin';
import { AuditLogRepository } from '../../core/repositories/audit-log.repository';
import {
  NewResin,
  ResinInventorySearch,
  ResinRepository,
  ResinStockCounts,
} from '../../core/repositories/resin.repository';
import { Result } from '../../core/result';

interface ResinsState {
  items: Resin[];
  total: number;
  counts: ResinStockCounts;
  loading: boolean;
  /** Mensaje para el usuario; null si no hay error. */
  error: string | null;
  /** Falso hasta que llega la primera respuesta: distingue "cargando" de "sin resinas". */
  loaded: boolean;
}

const EMPTY_COUNTS: ResinStockCounts = { all: 0, low: 0, out: 0 };

function auditDetail(resin: Pick<NewResin, 'description' | 'design' | 'line' | 'material' | 'technology' | 'price' | 'quantity'>) {
  return {
    descripcion: resin.description,
    diseno: resin.design,
    linea: resin.line,
    material: resin.material,
    tecnologia: resin.technology,
    precio: resin.price,
    cantidad: resin.quantity,
  };
}

/**
 * Estado de Settings · Resinas (= Resins Notifier de Flutter, reescrito: acá no hay controllers
 * de texto, el formulario vive en el diálogo). Se provee en la página (providers: [ResinsStore]).
 */
@Injectable()
export class ResinsStore {
  private readonly repo = inject(ResinRepository);
  private readonly auditLog = inject(AuditLogRepository);

  private readonly state = signal<ResinsState>({
    items: [],
    total: 0,
    counts: EMPTY_COUNTS,
    loading: false,
    error: null,
    loaded: false,
  });

  readonly items = computed(() => this.state().items);
  readonly total = computed(() => this.state().total);
  readonly counts = computed(() => this.state().counts);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly loaded = computed(() => this.state().loaded);

  /** Número de la última búsqueda lanzada: una respuesta vieja no pisa a una más nueva. */
  private lastRequest = 0;

  /** Última búsqueda pedida: se repite después de crear/editar/eliminar para que la lista quede al día. */
  private lastSearch: ResinInventorySearch | null = null;

  async load(search: ResinInventorySearch): Promise<void> {
    this.lastSearch = search;
    const request = ++this.lastRequest;
    this.state.update((s) => ({ ...s, loading: true, error: null }));

    const [page, counts] = await Promise.all([this.repo.listInventory(search), this.repo.countByStock(search)]);
    if (request !== this.lastRequest) return;

    if (!page.ok) {
      this.state.update((s) => ({ ...s, loading: false, error: page.error.message, loaded: true }));
      return;
    }
    this.state.update((s) => ({
      ...s,
      items: page.value.items,
      total: page.value.total,
      counts: counts.ok ? counts.value : s.counts,
      loading: false,
      loaded: true,
    }));
  }

  async create(resin: NewResin, actorEmail: string): Promise<Result<Resin, AppError>> {
    const result = await this.repo.insert(resin);
    if (result.ok) {
      void this.auditLog.log({ action: 'create_resin', entity: 'resin', entityId: String(result.value.id), detail: auditDetail(resin) }, actorEmail);
      if (this.lastSearch) await this.load(this.lastSearch);
    }
    return result;
  }

  async update(resin: Resin, actorEmail: string): Promise<Result<void, AppError>> {
    const result = await this.repo.update(resin);
    if (result.ok) {
      void this.auditLog.log({ action: 'update_resin', entity: 'resin', entityId: String(resin.id), detail: auditDetail(resin) }, actorEmail);
      if (this.lastSearch) await this.load(this.lastSearch);
    }
    return result;
  }

  async remove(resin: Resin, actorEmail: string): Promise<Result<void, AppError>> {
    const result = await this.repo.delete(resin.id);
    if (result.ok) {
      void this.auditLog.log({ action: 'delete_resin', entity: 'resin', entityId: String(resin.id), detail: auditDetail(resin) }, actorEmail);
      if (this.lastSearch) await this.load(this.lastSearch);
    }
    return result;
  }
}
