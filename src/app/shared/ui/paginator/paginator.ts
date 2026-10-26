// C-08 Paginador
import { Component, computed, input, output } from '@angular/core';
import { LucideChevronLeft, LucideChevronRight, LucideDynamicIcon } from '@lucide/angular';
import { pageItems } from './page-items';

/**
 * Navegación entre páginas de una tabla: tamaño de página, rango visible y números.
 * No guarda estado: recibe `page`, `pageSize` y `total`, y avisa con `pageChange` y `pageSizeChange`.
 */
@Component({
  selector: 'onv-paginator',
  imports: [LucideDynamicIcon],
  templateUrl: './paginator.html',
  host: { class: 'flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3' },
})
export class Paginator {
  /** Página actual, desde 1. */
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly total = input.required<number>();
  readonly pageSizes = input<number[]>([10, 25, 50, 100]);

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  protected readonly items = computed(() => pageItems(this.page(), this.totalPages()));
  protected readonly firstShown = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1));
  protected readonly lastShown = computed(() => Math.min(this.page() * this.pageSize(), this.total()));

  protected readonly prevIcon = LucideChevronLeft;
  protected readonly nextIcon = LucideChevronRight;

  protected go(page: number): void {
    if (page >= 1 && page <= this.totalPages() && page !== this.page()) this.pageChange.emit(page);
  }

  protected changeSize(event: Event): void {
    this.pageSizeChange.emit(Number((event.target as HTMLSelectElement).value));
  }
}
