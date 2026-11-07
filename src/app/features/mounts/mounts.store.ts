import { Injectable, computed, inject, signal } from '@angular/core';
import { AppError } from '../../core/errors/app-error';
import { Mount } from '../../core/models/mount';
import { AuditLogRepository } from '../../core/repositories/audit-log.repository';
import { MountInventorySearch, MountRepository, MountStockCounts, NewMount } from '../../core/repositories/mount.repository';
import { RemoveOutcome } from '../../core/models/remove-outcome';
import { Result } from '../../core/result';

interface MountsState {
  items: Mount[];
  total: number;
  counts: MountStockCounts;
  loading: boolean;
  /** Mensaje para el usuario; null si no hay error. */
  error: string | null;
  /** Falso hasta que llega la primera respuesta: distingue "cargando" de "sin armazones". */
  loaded: boolean;
}

const EMPTY_COUNTS: MountStockCounts = { all: 0, low: 0, out: 0 };

function auditDetail(mount: Pick<NewMount, 'brand' | 'model' | 'color' | 'price' | 'stock' | 'branch'>) {
  return {
    marca: mount.brand,
    modelo: mount.model,
    color: mount.color,
    precio: mount.price,
    existencias: mount.stock,
    sucursal: mount.branch,
  };
}

/**
 * Estado de Settings · Armazones (= Mounts Notifier de Flutter, reescrito: el formulario vive en
 * el diálogo). Se provee en la página (providers: [MountsStore]).
 */
@Injectable()
export class MountsStore {
  private readonly repo = inject(MountRepository);
  private readonly auditLog = inject(AuditLogRepository);

  private readonly state = signal<MountsState>({
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
  private lastSearch: MountInventorySearch | null = null;

  async load(search: MountInventorySearch): Promise<void> {
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

  async create(mount: NewMount, actorEmail: string): Promise<Result<Mount, AppError>> {
    const result = await this.repo.insert(mount);
    if (result.ok) {
      void this.auditLog.log({ action: 'create_mount', entity: 'mount', entityId: String(result.value.id), detail: auditDetail(mount) }, actorEmail);
      if (this.lastSearch) await this.load(this.lastSearch);
    }
    return result;
  }

  async update(mount: Mount, actorEmail: string): Promise<Result<void, AppError>> {
    const result = await this.repo.update(mount);
    if (result.ok) {
      void this.auditLog.log({ action: 'update_mount', entity: 'mount', entityId: String(mount.id), detail: auditDetail(mount) }, actorEmail);
      if (this.lastSearch) await this.load(this.lastSearch);
    }
    return result;
  }

  /**
   * "Eliminar": borra si nunca se vendió; si ya se vendió lo archiva y el historial de ventas
   * conserva su referencia (la base decide, ver `remove_mount`). La auditoría dice cuál de las dos pasó.
   */
  async remove(mount: Mount, actorEmail: string): Promise<Result<RemoveOutcome, AppError>> {
    const result = await this.repo.remove(mount.id);
    if (result.ok) {
      const action = result.value === 'archived' ? 'archive_mount' : 'delete_mount';
      void this.auditLog.log({ action, entity: 'mount', entityId: String(mount.id), detail: auditDetail(mount) }, actorEmail);
      if (this.lastSearch) await this.load(this.lastSearch);
    }
    return result;
  }
}
