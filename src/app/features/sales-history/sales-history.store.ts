import { Injectable, computed, inject, signal } from '@angular/core';
import { AppError } from '../../core/errors/app-error';
import { AppConfigRepository } from '../../core/repositories/app-config.repository';
import { AuditLogRepository } from '../../core/repositories/audit-log.repository';
import { Payment } from '../../core/models/payment';
import { Sale } from '../../core/models/sale';
import { SaleItem } from '../../core/models/sale-item';
import { NewPayment, PaymentRepository } from '../../core/repositories/payment.repository';
import { SaleRepository, SaleSearch, SaleStatusCounts } from '../../core/repositories/sale.repository';
import { Result } from '../../core/result';
import { SalePaymentService } from '../../core/services/sale-payment.service';

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
  /** `app_config.feature_change_date`: apagado de emergencia para TODA la empresa (admin+). `true` hasta que se confirme lo contrario. El permiso individual del vendedor se lee de su propio `Profile.canChangeDate` (ver `SalesHistoryPage.canChangeDate`). */
  changeDateEnabled: boolean;
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
  private readonly salePayments = inject(SalePaymentService);
  private readonly appConfigRepo = inject(AppConfigRepository);
  private readonly auditLog = inject(AuditLogRepository);

  private readonly state = signal<SalesHistoryState>({
    items: [],
    total: 0,
    counts: EMPTY_COUNTS,
    loading: false,
    error: null,
    loaded: false,
    changeDateEnabled: true,
  });

  readonly items = computed(() => this.state().items);
  readonly total = computed(() => this.state().total);
  readonly counts = computed(() => this.state().counts);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly loaded = computed(() => this.state().loaded);
  readonly changeDateEnabled = computed(() => this.state().changeDateEnabled);
  /** Suma de `totalWithDiscount`/`rest` de la página visible (= fila de totales de S-05, no el total general). */
  readonly pageTotal = computed(() => this.state().items.reduce((sum, s) => sum + s.totalWithDiscount, 0));
  readonly pageRest = computed(() => this.state().items.reduce((sum, s) => sum + s.rest, 0));

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

  /** = Flutter leyendo `appFeaturesProvider`: si falla, se queda con el valor por defecto (habilitado). */
  async loadChangeDateFlag(): Promise<void> {
    const result = await this.appConfigRepo.list();
    if (!result.ok) return;
    const flag = result.value.find((f) => f.key === 'feature_change_date');
    if (flag) this.state.update((s) => ({ ...s, changeDateEnabled: flag.value }));
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
   * Inserta el abono y actualiza el saldo de la venta (los dos pasos viven en `SalePaymentService`,
   * compartido con la ficha del paciente y el Dashboard) y vuelve a pedir la lista.
   */
  async registerPayment(sale: Sale, payment: NewPayment, registeredById: string): Promise<Result<void, AppError>> {
    const result = await this.salePayments.register(sale, payment, registeredById);
    if (result.ok && this.lastSearch) await this.load(this.lastSearch);
    return result;
  }

  /** = `updateSaleDate` de Flutter (gateado por `changeDateEnabled`, lo revisa la página). */
  async changeDate(sale: Sale, newDate: string, actorEmail: string): Promise<Result<void, AppError>> {
    const result = await this.saleRepo.changeDate(sale.id, newDate);
    if (result.ok) {
      void this.auditLog.log(
        { action: 'change_date', entity: 'sale', entityId: sale.id, detail: { folio: sale.folio, old_value: sale.date, new_value: newDate } },
        actorEmail,
      );
      if (this.lastSearch) await this.load(this.lastSearch);
    }
    return result;
  }
}
