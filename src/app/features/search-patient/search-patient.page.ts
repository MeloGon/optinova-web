import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import {
  LucideDynamicIcon,
  LucideEllipsis,
  LucideMapPin,
  LucideRefreshCw,
  LucideSearch,
  LucideSearchX,
  LucideTriangleAlert,
  LucideUserPlus,
  LucideUsers,
  LucideX,
} from '@lucide/angular';
import { PatientSearch } from '../../core/repositories/patient.repository';
import { Badge } from '../../shared/ui/badge/badge';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Paginator } from '../../shared/ui/paginator/paginator';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { OnvTable, TableCard } from '../../shared/ui/table/table';
import { SearchPatientStore } from './search-patient.store';

const PAGE_SIZES = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

/** "3" → 3; lo que no sea un entero positivo vuelve a la página 1. */
function toPage(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

function toPageSize(value: string | undefined): number {
  const n = Number(value);
  return PAGE_SIZES.includes(n) ? n : DEFAULT_PAGE_SIZE;
}

/**
 * Buscar paciente (S-03, lista). = SearchPatientView de Flutter.
 * La URL guarda la búsqueda (?q=&page=&size=): `withComponentInputBinding` la entrega como inputs.
 */
@Component({
  selector: 'app-search-patient-page',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    RouterLink,
    LucideDynamicIcon,
    CdkMenu,
    CdkMenuItem,
    CdkMenuTrigger,
    Badge,
    EmptyState,
    Paginator,
    Skeleton,
    OnvTable,
    TableCard,
  ],
  providers: [SearchPatientStore],
  templateUrl: './search-patient.page.html',
})
export class SearchPatientPage {
  // Parámetros de la URL; llegan como texto o undefined si no están.
  readonly q = input<string>();
  readonly page = input<string>();
  readonly size = input<string>();

  protected readonly store = inject(SearchPatientStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly search = computed<PatientSearch>(() => ({
    query: (this.q() ?? '').trim(),
    page: toPage(this.page()),
    pageSize: toPageSize(this.size()),
  }));

  /** Lo que el usuario está escribiendo; no busca hasta Enter o "Buscar". */
  protected readonly text = new FormControl('', { nonNullable: true });

  protected readonly skeletonRows = Array.from({ length: 8 }, (_, i) => i);

  protected readonly icons = {
    search: LucideSearch,
    clear: LucideX,
    pin: LucideMapPin,
    more: LucideEllipsis,
    users: LucideUsers,
    searchX: LucideSearchX,
    userPlus: LucideUserPlus,
    alert: LucideTriangleAlert,
    retry: LucideRefreshCw,
  };

  constructor() {
    // Cada cambio de la URL lanza la búsqueda.
    effect(() => {
      const search = this.search();
      untracked(() => void this.store.load(search));
    });

    // Con "Atrás" el cuadro de texto vuelve a lo que decía la URL.
    effect(() => {
      const query = this.search().query;
      untracked(() => this.text.setValue(query));
    });

    // Página que ya no existe (se borraron pacientes, URL a mano): ir a la última.
    effect(() => {
      const { page, pageSize } = this.search();
      const lastPage = Math.ceil(this.store.total() / pageSize);
      const outOfRange =
        this.store.loaded() && !this.store.loading() && this.store.total() > 0 && page > lastPage;
      if (outOfRange) untracked(() => void this.navigate({ page: lastPage === 1 ? null : lastPage }));
    });
  }

  protected submit(): void {
    const query = this.text.value.trim();
    const current = this.search();
    if (query === current.query && current.page === 1) {
      void this.store.load(current); // misma búsqueda: la URL no cambia, se vuelve a pedir
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

  /** `null` quita el parámetro de la URL; lo demás se conserva. */
  private navigate(queryParams: Params): Promise<boolean> {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
