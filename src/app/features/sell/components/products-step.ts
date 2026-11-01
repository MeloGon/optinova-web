import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  LucideDynamicIcon,
  LucideGlasses,
  LucideInfo,
  LucideMinus,
  LucidePlus,
  LucideScanEye,
  LucideSearch,
  LucideTriangleAlert,
  LucideX,
} from '@lucide/angular';
import { ConfigService } from '../../../core/config/config.service';
import { Mount } from '../../../core/models/mount';
import { Resin } from '../../../core/models/resin';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Paginator } from '../../../shared/ui/paginator/paginator';
import { Segmented, SegmentedOption } from '../../../shared/ui/segmented/segmented';
import { Skeleton } from '../../../shared/ui/skeleton/skeleton';
import { OnvTable } from '../../../shared/ui/table/table';
import { CatalogOption, SellStore } from '../sell.store';

const CATEGORY_OPTIONS: SegmentedOption[] = [
  { value: 'resin', label: 'Resina' },
  { value: 'mount', label: 'Armazón' },
];

/**
 * Paso 2 de Vender (= S-04 paso 2): catálogo a la izquierda, carrito fijo a la derecha.
 * Sin la categoría "Otros" del diseño (ni Flutter ni esta base de datos tienen esa fuente de
 * productos todavía). Nada se busca solo: ni al entrar al paso ni al cambiar de categoría o de
 * sucursal (no tiene sentido traer todo el inventario cuando puede que el vendedor busque un
 * modelo puntual; pedido del dueño tras probar, 2026-10-31). Una vez agregado un producto, su fila
 * cambia a un stepper `− cantidad +` en vez de un botón "Agregado" que seguía agregando más al
 * tocarlo de nuevo (no quedaba claro que eso sumaba otra unidad).
 */
@Component({
  selector: 'app-sell-products-step',
  imports: [ReactiveFormsModule, LucideDynamicIcon, MoneyPipe, EmptyState, Paginator, Segmented, Skeleton, OnvTable],
  templateUrl: './products-step.html',
})
export class ProductsStep {
  protected readonly store = inject(SellStore);
  private readonly config = inject(ConfigService).config;

  protected readonly branches = computed(() => this.config().branches);
  protected readonly categoryOptions = CATEGORY_OPTIONS;

  protected readonly category = new FormControl<CatalogOption>('resin', { nonNullable: true });
  protected readonly text = new FormControl('', { nonNullable: true });
  protected readonly branchFilter = new FormControl('', { nonNullable: true });

  protected readonly icons = {
    resin: LucideGlasses,
    mount: LucideScanEye,
    search: LucideSearch,
    clear: LucideX,
    add: LucidePlus,
    minus: LucideMinus,
    info: LucideInfo,
    alert: LucideTriangleAlert,
  };

  protected readonly skeletonRows = [0, 1, 2, 3];
  /** Falso hasta el primer "Buscar": distingue "todavía no buscaste" de "sin resultados". */
  protected readonly searched = signal(false);

  /** El carrito tiene resinas pero ningún armazón todavía (= aviso "Falta el armazón" del diseño). */
  protected readonly missingMount = computed(
    () => this.store.cart().some((l) => l.item.kind === 'resin') && !this.store.cart().some((l) => l.item.kind === 'mount'),
  );

  constructor() {
    this.store.setCatalogOption(this.category.value);

    this.category.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.store.setCatalogOption(value);
      this.searched.set(false);
    });

    this.branchFilter.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.store.setCatalogBranch(value || null);
    });
  }

  protected submit(): void {
    this.searched.set(true);
    void this.store.searchCatalog(this.text.value);
  }

  protected clear(): void {
    this.text.setValue('');
    this.searched.set(true);
    void this.store.searchCatalog('');
  }

  protected mountCount(mount: Mount): number {
    return this.store.cart().filter((l) => l.item.kind === 'mount' && l.item.mountId === mount.id).length;
  }

  /** Stock mostrado menos lo que ya está en el carrito (pedido del dueño tras probar, 2026-10-31). */
  protected remainingStock(mount: Mount): number {
    return mount.stock - this.mountCount(mount);
  }

  protected goToPage(page: number): void {
    void this.store.setCatalogPage(page);
  }

  protected resinCount(resin: Resin): number {
    return this.store.cart().filter((l) => l.item.kind === 'resin' && l.item.resinId === resin.id).length;
  }

  protected addMount(mount: Mount): void {
    this.store.addMount(mount);
  }

  protected addResin(resin: Resin): void {
    this.store.addResin(resin);
  }

  protected decrementMount(mount: Mount): void {
    const line = this.store.cart().find((l) => l.item.kind === 'mount' && l.item.mountId === mount.id);
    if (line) this.store.removeCartLine(line.localId);
  }

  protected decrementResin(resin: Resin): void {
    const line = this.store.cart().find((l) => l.item.kind === 'resin' && l.item.resinId === resin.id);
    if (line) this.store.removeCartLine(line.localId);
  }

  protected remove(localId: number): void {
    this.store.removeCartLine(localId);
  }
}
