import { Injectable, computed, inject, signal } from '@angular/core';
import { Sale } from '../../core/models/sale';
import {
  SalesBySellerReportRepository,
  SellerDetailSearch,
} from '../../core/repositories/sales-by-seller-report.repository';

export type { SellerDetailSearch as SellerSalesSearch } from '../../core/repositories/sales-by-seller-report.repository';

interface SellerSalesState {
  /** Solo la página pedida: ya viene paginada por el servidor, no todo el mes. */
  sales: Sale[];
  /** Cantidad total de ventas del vendedor en el período (para el paginador). */
  total: number;
  totals: { total: number; account: number; rest: number };
  loading: boolean;
  /** Mensaje para el usuario; null si no hay error. */
  error: string | null;
  /** Falso hasta que llega la primera respuesta: distingue "cargando" de "sin ventas". */
  loaded: boolean;
}

const EMPTY_TOTALS = { total: 0, account: 0, rest: 0 };

/**
 * Estado del detalle de un vendedor (al presionar su nombre en Ventas por vendedor). Página
 * propia con ruta y paginación reales (= mismo motivo que la ficha de paciente, S-03: un
 * vendedor con muchas ventas no cabe en un diálogo ni es cómodo en mobile). Pide directo a
 * `sales_by_seller_detail` (#23) la página y los totales del vendedor: ya no trae el mes
 * completo de todos los vendedores para filtrar/paginar en el navegador.
 */
@Injectable()
export class SellerSalesStore {
  private readonly repo = inject(SalesBySellerReportRepository);

  private readonly state = signal<SellerSalesState>({
    sales: [],
    total: 0,
    totals: EMPTY_TOTALS,
    loading: false,
    error: null,
    loaded: false,
  });

  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly loaded = computed(() => this.state().loaded);
  readonly total = computed(() => this.state().total);
  readonly page = computed(() => this.state().sales);
  readonly totals = computed(() => this.state().totals);

  /** Número de la última búsqueda lanzada: una respuesta vieja no pisa a una más nueva. */
  private lastRequest = 0;

  async load(search: SellerDetailSearch): Promise<void> {
    const request = ++this.lastRequest;
    this.state.update((s) => ({ ...s, loading: true, error: null }));

    const result = await this.repo.detail(search);
    if (request !== this.lastRequest) return;

    if (result.ok) {
      const { sales, totalCount, total, account, rest } = result.value;
      this.state.update((s) => ({ ...s, sales, total: totalCount, totals: { total, account, rest }, loading: false, loaded: true }));
    } else {
      this.state.update((s) => ({ ...s, loading: false, error: result.error.message, loaded: true }));
    }
  }
}
