import { Injectable, computed, inject, signal } from '@angular/core';
import { AppError } from '../../core/errors/app-error';
import { Payment } from '../../core/models/payment';
import { Sale } from '../../core/models/sale';
import { SaleItem } from '../../core/models/sale-item';
import { NewPayment, PaymentRepository } from '../../core/repositories/payment.repository';
import { SaleRepository, SaleSearch, SaleStatusCounts } from '../../core/repositories/sale.repository';
import { Result } from '../../core/result';

const EMPTY_COUNTS: SaleStatusCounts = { all: 0, balance: 0, paid: 0 };

interface SalesHistoryState {
  items: Sale[];
  total: number;
  counts: SaleStatusCounts;
  loading: boolean;
  /** Mensaje para el usuario; null si no hay error. */
  error: string | null;
  /** Falso hasta que llega la primera respuesta: distingue "cargando" de "sin ventas". */
  loaded: boolean;
}

/**
 * Estado de Historial de ventas (= SalesHistory Notifier de Flutter, recortado al alcance de E2.5:
 * listado, filtros y abonos; sin crear, editar, finalizar, anular ni eliminar ventas).
 * Se provee en la página (providers: [SalesHistoryStore]): nace y muere con ella (= autoDispose).
 */
@Injectable()
export class SalesHistoryStore {
  private readonly saleRepo = inject(SaleRepository);
  private readonly paymentRepo = inject(PaymentRepository);

  private readonly state = signal<SalesHistoryState>({
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

  /** Última búsqueda pedida: se repite después de registrar un abono para que la lista quede al día. */
  private lastSearch: SaleSearch | null = null;

  async load(search: SaleSearch): Promise<void> {
    this.lastSearch = search;
    const request = ++this.lastRequest;
    this.state.update((s) => ({ ...s, loading: true, error: null }));

    const [result, countsResult] = await Promise.all([
      this.saleRepo.search(search),
      this.saleRepo.countByStatus(search),
    ]);
    if (request !== this.lastRequest) return;

    if (result.ok) {
      this.state.update((s) => ({
        ...s,
        items: result.value.items,
        total: result.value.total,
        counts: countsResult.ok ? countsResult.value : s.counts,
        loading: false,
        loaded: true,
      }));
    } else {
      this.state.update((s) => ({ ...s, loading: false, error: result.error.message, loaded: true }));
    }
  }

  /** Líneas de una venta por su folio (= getSaleDetails de Flutter). */
  async loadItems(folio: string): Promise<Result<SaleItem[], AppError>> {
    return this.saleRepo.getItems(folio);
  }

  /** Abonos de una venta, del más antiguo al más reciente. */
  async loadPayments(saleId: string): Promise<Result<Payment[], AppError>> {
    return this.paymentRepo.listBySale(saleId);
  }

  /**
   * Inserta el abono y actualiza el saldo de la venta (= registerPayment de Flutter: dos pasos,
   * uno por repositorio). Si el segundo paso falla, el pago ya quedó insertado: igual que Flutter,
   * no se revierte (es una cuenta por cobrar real, no conviene perder el registro del abono).
   */
  async registerPayment(sale: Sale, payment: NewPayment, registeredById: string): Promise<Result<void, AppError>> {
    const inserted = await this.paymentRepo.create(payment, registeredById);
    if (!inserted.ok) return inserted;

    const newAccount = sale.account + payment.amount;
    const newRest = Math.max(sale.totalWithDiscount - newAccount, 0);
    const result = await this.saleRepo.applyPayment(sale.id, newAccount, newRest, payment.date);
    if (result.ok && this.lastSearch) await this.load(this.lastSearch);
    return result;
  }
}
