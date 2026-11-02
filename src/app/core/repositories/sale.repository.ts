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
   * Aplica un abono al saldo: nuevo total abonado, nuevo resto y la fecha del abono como última
   * actividad (= updateAccountPayment de Flutter). No inserta el pago; eso lo hace
   * `PaymentRepository.create` antes de llamar a esto.
   */
  abstract applyPayment(
    saleId: string,
    newAccount: number,
    newRest: number,
    paymentDate: string,
  ): Promise<Result<void, AppError>>;

  /**
   * Crea la venta y sus líneas (= `_createShortSale` de Flutter, con el orden invertido: primero
   * el encabezado porque `venta_items.venta_id` tiene FK a `ventas.id` desde el cambio #8 — en
   * PROD esa FK no existe, así que Flutter podía insertar las líneas antes sin problema).
   * Dos inserts secuenciales, no atómico (misma tolerancia que `applyPayment`/`registerPayment`):
   * si el segundo falla, la venta queda creada sin líneas.
   */
  abstract create(sale: NewSale, items: NewSaleItem[]): Promise<Result<Sale, AppError>>;
}
