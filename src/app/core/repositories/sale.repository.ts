import { AppError } from '../errors/app-error';
import { Page } from '../models/page';
import { Sale } from '../models/sale';
import { SaleItem } from '../models/sale-item';
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
}

export interface SaleStatusCounts {
  all: number;
  balance: number;
  paid: number;
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
}
