import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router } from '@angular/router';
import {
  LucideClock,
  LucideDynamicIcon,
  LucideRefreshCw,
  LucideSearch,
  LucideShieldCheck,
  LucideTrash2,
  LucideTriangleAlert,
  LucideX,
} from '@lucide/angular';
import { AuditLogSearch } from '../../core/repositories/audit-log.repository';
import { DatePipe } from '@angular/common';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Paginator } from '../../shared/ui/paginator/paginator';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { OnvTable, TableCard } from '../../shared/ui/table/table';
import { AuditLogsStore } from './audit-logs.store';

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

/** "create_resin" → "Crear resina"; si no la conoce, muestra la acción tal cual. */
const ACTION_LABELS: Record<string, string> = {
  create_resin: 'Crear resina',
  update_resin: 'Editar resina',
  delete_resin: 'Eliminar resina',
  create_mount: 'Crear armazón',
  update_mount: 'Editar armazón',
  delete_mount: 'Eliminar armazón',
  create_sale: 'Crear venta',
  delete_sale: 'Eliminar venta',
  change_date: 'Cambiar fecha',
  register_payment: 'Registrar pago',
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/** `{a: 1, b: 2}` → `"a: 1 · b: 2"`, para una fila de tabla sin abrir un diálogo. */
function formatDetail(detail: Record<string, unknown>): string {
  const text = Object.entries(detail)
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
    .join(' · ');
  return text || '—';
}

/**
 * Settings · Auditoría: visor de solo lectura de `audit_logs` (sin pantalla equivalente directa
 * en Flutter). Nadie crea/edita/borra un registro a mano; el cron del cambio #17 es el único que
 * limpia filas de más de 3 meses, y la franja de arriba deja ver ese efecto antes de que ocurra.
 * URL guarda el filtro (?q=&page=&size=).
 */
@Component({
  selector: 'app-audit-logs-page',
  imports: [ReactiveFormsModule, DatePipe, LucideDynamicIcon, EmptyState, Paginator, Skeleton, OnvTable, TableCard],
  providers: [AuditLogsStore],
  templateUrl: './audit-logs.page.html',
})
export class AuditLogsPage {
  readonly q = input<string>();
  readonly page = input<string>();
  readonly size = input<string>();

  protected readonly store = inject(AuditLogsStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly search = computed<AuditLogSearch>(() => ({
    query: (this.q() ?? '').trim(),
    page: toPage(this.page()),
    pageSize: toPageSize(this.size()),
  }));

  /** Lo que el usuario está escribiendo; no busca hasta Enter o "Buscar". */
  protected readonly text = new FormControl('', { nonNullable: true });

  protected readonly skeletonRows = Array.from({ length: 6 }, (_, i) => i);
  protected readonly actionLabel = actionLabel;
  protected readonly formatDetail = formatDetail;

  protected readonly icons = {
    shield: LucideShieldCheck,
    clock: LucideClock,
    cleanup: LucideTrash2,
    search: LucideSearch,
    clear: LucideX,
    alert: LucideTriangleAlert,
    retry: LucideRefreshCw,
  };

  constructor() {
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

  protected clear(): void {
    this.text.setValue('');
    this.submit();
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

  private navigate(queryParams: Params): Promise<boolean> {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
