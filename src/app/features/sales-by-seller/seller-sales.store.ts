import { Injectable, computed, inject, signal } from '@angular/core';
import { Sale } from '../../core/models/sale';
import { SaleMonthSearch, SaleRepository } from '../../core/repositories/sale.repository';
import { sellerKey } from './seller-key';

export interface SellerSalesSearch extends SaleMonthSearch {
  sellerName: string;
  /** Empieza en 1. */
  page: number;
  pageSize: number;
}

interface SellerSalesState {
  /** Ya filtradas por vendedor, de la más reciente a la más antigua. */
  sales: Sale[];
  loading: boolean;
  /** Mensaje para el usuario; null si no hay error. */
  error: string | null;
  /** Falso hasta que llega la primera respuesta: distingue "cargando" de "sin ventas". */
  loaded: boolean;
}

/**
 * Estado del detalle de un vendedor (al presionar su nombre en Ventas por vendedor). Página
 * propia con ruta y paginación reales (= mismo motivo que la ficha de paciente, S-03: un
 * vendedor con muchas ventas no cabe en un diálogo ni es cómodo en mobile). Trae de nuevo las
 * ventas del mes (no las recibe de la página anterior) para que la URL sea la fuente de verdad y
 * refrescar/compartir el enlace funcione igual que en cualquier otra pantalla de la app.
 */
@Injectable()
export class SellerSalesStore {
  private readonly repo = inject(SaleRepository);

  private readonly state = signal<SellerSalesState>({
    sales: [],
    loading: false,
    error: null,
    loaded: false,
  });

  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly loaded = computed(() => this.state().loaded);
  readonly total = computed(() => this.state().sales.length);

  private lastSearch: SellerSalesSearch | null = null;

  /** Página pedida, cortada en memoria: ya se trajo el mes completo, no hace falta otra consulta. */
  readonly page = computed(() => {
    const search = this.lastSearch;
    if (!search) return [];
    const from = (search.page - 1) * search.pageSize;
    return this.state().sales.slice(from, from + search.pageSize);
  });

  readonly totals = computed(() => {
    const sales = this.state().sales;
    return {
      total: sales.reduce((sum, s) => sum + s.totalWithDiscount, 0),
      account: sales.reduce((sum, s) => sum + s.account, 0),
      rest: sales.reduce((sum, s) => sum + s.rest, 0),
    };
  });

  /** Número de la última búsqueda lanzada: una respuesta vieja no pisa a una más nueva. */
  private lastRequest = 0;

  async load(search: SellerSalesSearch): Promise<void> {
    this.lastSearch = search;
    const request = ++this.lastRequest;
    this.state.update((s) => ({ ...s, loading: true, error: null }));

    const result = await this.repo.listByMonth(search);
    if (request !== this.lastRequest) return;

    if (result.ok) {
      const sales = result.value
        .filter((sale) => sellerKey(sale) === search.sellerName)
        .sort((a, b) => b.date.localeCompare(a.date));
      this.state.update((s) => ({ ...s, sales, loading: false, loaded: true }));
    } else {
      this.state.update((s) => ({ ...s, loading: false, error: result.error.message, loaded: true }));
    }
  }
}
