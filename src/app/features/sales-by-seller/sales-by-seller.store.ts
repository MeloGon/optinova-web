import { Injectable, computed, inject, signal } from '@angular/core';
import { Sale } from '../../core/models/sale';
import { SaleMonthSearch, SaleRepository } from '../../core/repositories/sale.repository';
import { sellerKey } from './seller-key';

export interface SellerAggregate {
  name: string;
  salesCount: number;
  total: number;
  account: number;
  rest: number;
}

interface SalesBySellerState {
  sales: Sale[];
  loading: boolean;
  /** Mensaje para el usuario; null si no hay error. */
  error: string | null;
  /** Falso hasta que llega la primera respuesta: distingue "cargando" de "sin ventas". */
  loaded: boolean;
}

/**
 * Estado de Settings · Ventas por vendedor (= SalesBySeller Notifier de Flutter, re-pensado: acá
 * se agrupa por vendedor en una sola tabla de agregados, no una sección-con-tabla-propia por
 * cada uno — misma información, sin repetir la UI N veces). Se provee en la página
 * (providers: [SalesBySellerStore]).
 */
@Injectable()
export class SalesBySellerStore {
  private readonly repo = inject(SaleRepository);

  private readonly state = signal<SalesBySellerState>({
    sales: [],
    loading: false,
    error: null,
    loaded: false,
  });

  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly loaded = computed(() => this.state().loaded);

  /** Un renglón por vendedor, del que más vendió al que menos (= el ranking del Dashboard). */
  readonly sellers = computed<SellerAggregate[]>(() => {
    const byName = new Map<string, SellerAggregate>();
    for (const sale of this.state().sales) {
      const key = sellerKey(sale);
      const current = byName.get(key) ?? { name: key, salesCount: 0, total: 0, account: 0, rest: 0 };
      current.salesCount += 1;
      current.total += sale.totalWithDiscount;
      current.account += sale.account;
      current.rest += sale.rest;
      byName.set(key, current);
    }
    return [...byName.values()].sort((a, b) => b.total - a.total);
  });

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

  async load(search: SaleMonthSearch): Promise<void> {
    const request = ++this.lastRequest;
    this.state.update((s) => ({ ...s, loading: true, error: null }));

    const result = await this.repo.listByMonth(search);
    if (request !== this.lastRequest) return;

    if (result.ok) {
      this.state.update((s) => ({ ...s, sales: result.value, loading: false, loaded: true }));
    } else {
      this.state.update((s) => ({ ...s, loading: false, error: result.error.message, loaded: true }));
    }
  }
}
