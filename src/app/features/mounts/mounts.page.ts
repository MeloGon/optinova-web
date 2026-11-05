import { Dialog } from '@angular/cdk/dialog';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router } from '@angular/router';
import {
  LucideDynamicIcon,
  LucidePlus,
  LucideRefreshCw,
  LucideScanEye,
  LucideSearch,
  LucideSquarePen,
  LucideTrash2,
  LucideTriangleAlert,
  LucideX,
} from '@lucide/angular';
import { SessionStore } from '../../core/auth/session.store';
import { ConfigService } from '../../core/config/config.service';
import { Mount } from '../../core/models/mount';
import { StockStatus } from '../../core/models/stock-status';
import { MountInventorySearch } from '../../core/repositories/mount.repository';
import { ConfirmService } from '../../shared/ui/dialog/confirm.service';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { Paginator } from '../../shared/ui/paginator/paginator';
import { Segmented, SegmentedOption } from '../../shared/ui/segmented/segmented';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { OnvTable, TableCard } from '../../shared/ui/table/table';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { MountFormDialog, MountFormDialogData, MOUNT_FORM_TITLE_ID } from './components/mount-form-dialog';
import { MountsStore } from './mounts.store';

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

function toStockStatus(value: string | undefined): StockStatus {
  return value === 'low' || value === 'out' ? value : 'all';
}

/**
 * Settings · Armazones (sin pantalla equivalente directa en Flutter: ahí es una lista de
 * tarjetas; acá sigue el mismo patrón que Egresos/Historial de ventas/Resinas).
 * URL guarda el filtro (?q=&branch=&stock=&page=&size=).
 */
@Component({
  selector: 'app-mounts-page',
  imports: [ReactiveFormsModule, MoneyPipe, LucideDynamicIcon, EmptyState, Paginator, Segmented, Skeleton, OnvTable, TableCard],
  providers: [MountsStore],
  templateUrl: './mounts.page.html',
})
export class MountsPage {
  readonly q = input<string>();
  readonly branch = input<string>();
  readonly stock = input<string>();
  readonly page = input<string>();
  readonly size = input<string>();

  protected readonly store = inject(MountsStore);
  private readonly session = inject(SessionStore);
  private readonly config = inject(ConfigService).config;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(Dialog);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly branches = computed(() => this.config().branches);

  protected readonly search = computed<MountInventorySearch>(() => ({
    query: (this.q() ?? '').trim(),
    branch: this.branch() || null,
    stockStatus: toStockStatus(this.stock()),
    page: toPage(this.page()),
    pageSize: toPageSize(this.size()),
  }));

  protected readonly stockOptions = computed<SegmentedOption[]>(() => {
    const c = this.store.counts();
    return [
      { value: 'all', label: 'Todos', count: c.all },
      { value: 'low', label: 'Stock bajo', count: c.low },
      { value: 'out', label: 'Agotados', count: c.out },
    ];
  });

  /** Lo que el usuario está escribiendo; no busca hasta Enter o "Buscar". */
  protected readonly text = new FormControl('', { nonNullable: true });
  protected readonly stockControl = new FormControl<StockStatus>('all', { nonNullable: true });

  protected readonly skeletonRows = Array.from({ length: 6 }, (_, i) => i);

  protected readonly icons = {
    mount: LucideScanEye,
    plus: LucidePlus,
    search: LucideSearch,
    clear: LucideX,
    edit: LucideSquarePen,
    trash: LucideTrash2,
    alert: LucideTriangleAlert,
    retry: LucideRefreshCw,
  };

  protected readonly loadingDelete = signal<string | null>(null);

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

    effect(() => {
      const stockStatus = this.search().stockStatus;
      untracked(() => this.stockControl.setValue(stockStatus, { emitEvent: false }));
    });

    this.stockControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (value !== this.search().stockStatus) void this.navigate({ stock: value === 'all' ? null : value, page: null });
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

  protected setBranch(value: string): void {
    void this.navigate({ branch: value || null, page: null });
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

  private get actorEmail(): string {
    return this.session.profile()?.email ?? '';
  }

  protected openNew(): void {
    const data: MountFormDialogData = {
      mount: null,
      save: (draft) => this.store.create(draft, this.actorEmail),
    };
    const ref = this.dialog.open<boolean>(MountFormDialog, {
      data,
      role: 'dialog',
      ariaLabelledBy: MOUNT_FORM_TITLE_ID,
      disableClose: true,
      backdropClass: ['bg-overlay'],
    });
    ref.closed.subscribe((saved) => {
      if (saved) this.toast.show({ tone: 'success', title: 'Armazón creado' });
    });
  }

  protected openEdit(mount: Mount): void {
    const data: MountFormDialogData = {
      mount,
      save: (draft) => this.store.update({ ...mount, ...draft }, this.actorEmail),
    };
    const ref = this.dialog.open<boolean>(MountFormDialog, {
      data,
      role: 'dialog',
      ariaLabelledBy: MOUNT_FORM_TITLE_ID,
      disableClose: true,
      backdropClass: ['bg-overlay'],
    });
    ref.closed.subscribe((saved) => {
      if (saved) this.toast.show({ tone: 'success', title: 'Armazón actualizado' });
    });
  }

  protected async askDelete(mount: Mount): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: '¿Eliminar este armazón?',
      text: `"${mount.brand} ${mount.model}" no se puede deshacer.`,
      confirmLabel: 'Eliminar armazón',
    });
    if (!confirmed) return;

    this.loadingDelete.set(mount.id);
    const result = await this.store.remove(mount, this.actorEmail);
    this.loadingDelete.set(null);

    if (result.ok) {
      this.toast.show({ tone: 'success', title: 'Armazón eliminado' });
    } else {
      this.toast.show({ tone: 'danger', title: 'No se pudo eliminar', text: result.error.message });
    }
  }

  private navigate(queryParams: Params): Promise<boolean> {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
