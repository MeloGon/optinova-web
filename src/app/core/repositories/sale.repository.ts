import { AppError } from '../errors/app-error';
import { Page } from '../models/page';
import { Sale } from '../models/sale';
import { NewSaleItem, SaleItem } from '../models/sale-item';
import { Result } from '../result';

export type SaleStatus = 'all' | 'balance' | 'paid';

export interface SaleSearch {
  /** Busca en paciente y folio a la vez (= S-05: un solo buscador, sin elegir el campo). */
  query: string;
  branch: string | null;
  /** `yyyy-MM-dd` exacta; null = cualquier fecha. */
  date: string | null;
  status: SaleStatus;
  /** Empieza en 1. */
  page: number;
  pageSize: number;
  /** Si viene, acota a las ventas de ese paciente por `paciente_id` (= la ficha, S-03). */
  patientId?: string;
}

export interface SaleStatusCounts {
  all: number;
  balance: number;
  paid: number;
}

/** Venta nueva a crear (= el encabezado que arma Vender antes de confirmar). */
export interface NewSale {
  branch: string;
  /** `yyyy-MM-dd`. */
  date: string;
  patientName: string;
  /**
   * FK real a `pacientes.id`; siempre se conoce en Vender (viene de elegir un paciente de la
   * búsqueda). Texto, no número: igual motivo que `Patient.id`/`Review.patientId` (ver
   * supabase-patient.repository) — algunos IDs históricos de 17 dígitos superan lo que
   * JavaScript puede guardar exacto.
   */
  patientId: string;
  sellerName: string;
  total: number;
  discount: number;
  discountReason: string | null;
  totalWithDiscount: number;
  account: number;
  rest: number;
}

/** Cómo se pagó el monto a cuenta de una venta nueva (el monto sale de `NewSale.account`). */
export interface NewInitialPayment {
  paymentMethod: string;
  notes: string;
}

/** Contrato de ventas (= SaleRepository abstracto de Flutter, recortado al alcance de E2.5). */
export abstract class SaleRepository {
  /** Ventas de la más reciente a la más antigua. */
  abstract search(params: SaleSearch): Promise<Result<Page<Sale>, AppError>>;

  /** Cuántas ventas hay por estado, con el mismo texto/sucursal/fecha que `search` (para el segmented). */
  abstract countByStatus(
    params: Omit<SaleSearch, 'status' | 'page' | 'pageSize'>,
  ): Promise<Result<SaleStatusCounts, AppError>>;

  /** Líneas de una venta por su folio (= getSaleDetails de Flutter, que también filtra por folio). */
  abstract getItems(folio: string): Promise<Result<SaleItem[], AppError>>;

  /**
   * Crea la venta, sus líneas, el descuento de stock y el pago inicial en UNA transacción
   * (función `create_sale`, migración #26): si algo falla no queda nada a medias, ni una venta sin
   * líneas ni stock descontado de una venta que no existe. Flutter lo hacía en pasos sueltos.
   * El servidor recalcula el total desde las líneas, valida descuento y monto a cuenta, y rechaza
   * un armazón sin stock suficiente; el monto del pago inicial es siempre `sale.account`.
   */
  abstract create(sale: NewSale, items: NewSaleItem[], initialPayment: NewInitialPayment | null): Promise<Result<Sale, AppError>>;

  /**
   * Corrige la fecha mostrada de una venta (= `updateSaleDate` de Flutter, pero sobre
   * `fecha_actualizada`, el campo que la app realmente usa — Flutter corrige `"FECHA"`/
   * `"FECHA DE VENTA"`, campos de respaldo que acá nadie lee desde el cambio #8). Gateada por el
   * flag `feature_change_date` de Settings · Features; sin restricción de rol, igual que Flutter.
   */
  abstract changeDate(saleId: string, newDate: string): Promise<Result<void, AppError>>;
}
