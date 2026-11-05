import { Injectable, computed, inject, signal } from '@angular/core';
import {
  SalesBySellerReportRepository,
  SellerAggregate,
  SellerSummarySearch,
} from '../../core/repositories/sales-by-seller-report.repository';

interface SalesBySellerState {
  sellers: SellerAggregate[];
  loading: boolean;
  /** Mensaje para el usuario; null si no hay error. */
  error: string | null;
  /** Falso hasta que llega la primera respuesta: distingue "cargando" de "sin ventas". */
  loaded: boolean;
}

/**
 * Estado de Settings · Ventas por vendedor (= SalesBySeller Notifier de Flutter, re-pensado: acá
 * se agrupa por vendedor en una sola tabla de agregados, no una sección-con-tabla-propia por
 * cada uno — misma información, sin repetir la UI N veces). El ranking ya viene agregado y
 * ordenado por `sales_by_seller_summary` (#23): el store no agrupa ni suma, solo lo muestra. Se
 * provee en la página (providers: [SalesBySellerStore]).
 */
@Injectable()
export class SalesBySellerStore {
  private readonly repo = inject(SalesBySellerReportRepository);

  private readonly state = signal<SalesBySellerState>({
    sellers: [],
    loading: false,
    error: null,
    loaded: false,
  });

  readonly sellers = computed(() => this.state().sellers);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly loaded = computed(() => this.state().loaded);

  readonly totals = computed(() => {
    const sellers = this.sellers();
    return {
      sellerCount: sellers.length,
      salesCount: sellers.reduce((sum, s) => sum + s.salesCount, 0),
      total: sellers.reduce((sum, s) => sum + s.total, 0),
      rest: sellers.reduce((sum, s) => sum + s.rest, 0),
    };
  });

  /** Número de la última búsqueda lanzada: una respuesta vieja no pisa a una más nueva. */
  private lastRequest = 0;

  async load(search: SellerSummarySearch): Promise<void> {
    const request = ++this.lastRequest;
    this.state.update((s) => ({ ...s, loading: true, error: null }));

    const result = await this.repo.summary(search);
    if (request !== this.lastRequest) return;

    if (result.ok) {
      this.state.update((s) => ({ ...s, sellers: result.value, loading: false, loaded: true }));
    } else {
      this.state.update((s) => ({ ...s, loading: false, error: result.error.message, loaded: true }));
    }
  }
}
