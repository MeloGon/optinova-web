import { AppError } from '../errors/app-error';
import { Sale } from '../models/sale';
import { Result } from '../result';

export interface SellerSummarySearch {
  /** `yyyy-MM`. */
  month: string;
  branch: string | null;
}

export interface SellerAggregate {
  name: string;
  salesCount: number;
  total: number;
  account: number;
  rest: number;
}

export interface SellerDetailSearch extends SellerSummarySearch {
  sellerName: string;
  /** Empieza en 1. */
  page: number;
  pageSize: number;
}

export interface SellerDetailData {
  /** Ya paginadas por el servidor: solo las de esta página, no todo el mes. */
  sales: Sale[];
  /** Cantidad total de ventas del vendedor en el período (para el paginador). */
  totalCount: number;
  total: number;
  account: number;
  rest: number;
}

/**
 * Contrato de "Ventas por vendedor" (E2.8): dos funciones del servidor
 * (`sales_by_seller_summary`/`sales_by_seller_detail`, `SECURITY DEFINER`, mismo molde que
 * `dashboard_summary`/`payments_report`, cambio #23) en vez de traer el mes completo de TODAS
 * las ventas al navegador para agrupar/filtrar/paginar ahí. Reemplaza a
 * `SaleRepository.listByMonth` (eliminado del contrato en el mismo cambio). Hallazgo del dueño,
 * 2026-11-06: cuidar el consumo de Supabase antes de que el volumen real lo vuelva un problema.
 */
export abstract class SalesBySellerReportRepository {
  /** Ranking por vendedor, ya agregado y ordenado de mayor a menor por el servidor. */
  abstract summary(search: SellerSummarySearch): Promise<Result<SellerAggregate[], AppError>>;

  /** Ventas de un vendedor, paginadas de verdad en el servidor, con sus totales del período completo. */
  abstract detail(search: SellerDetailSearch): Promise<Result<SellerDetailData, AppError>>;
}
