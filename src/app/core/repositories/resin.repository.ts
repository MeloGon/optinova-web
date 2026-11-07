import { AppError } from '../errors/app-error';
import { Page } from '../models/page';
import { RemoveOutcome } from '../models/remove-outcome';
import { Resin } from '../models/resin';
import { StockStatus } from '../models/stock-status';
import { Result } from '../result';

export interface ResinSearch {
  query: string;
  /** Empieza en 1. */
  page: number;
  pageSize: number;
}

export interface ResinInventorySearch {
  query: string;
  /** "low" = 1 o 2 unidades (mismo umbral que el Dashboard); "out" = 0. */
  stockStatus: StockStatus;
  /** Empieza en 1. */
  page: number;
  pageSize: number;
}

export interface ResinStockCounts {
  all: number;
  low: number;
  out: number;
}

/** `text` se arma solo a partir del resto de campos (= Flutter); no lo pide el formulario. */
export type NewResin = Omit<Resin, 'id' | 'text'>;

/** Contrato de resinas. Recortado al alcance de E2.6: sin alta/edición. */
export abstract class ResinRepository {
  /**
   * Busca en `descripcion` y `texto` (Flutter solo buscaba en `texto`, pero ahí no vive el nombre
   * que se muestra en el catálogo —`descripcion`—, así que escribir el nombre completo no
   * encontraba nada; corregido tras probar, 2026-10-31). Paginado para no traer el catálogo entero.
   */
  abstract search(params: ResinSearch): Promise<Result<Page<Resin>, AppError>>;

  /** Listado completo para Settings · Resinas (incluye agotadas; `search` nunca las necesitaba). */
  abstract listInventory(params: ResinInventorySearch): Promise<Result<Page<Resin>, AppError>>;

  abstract countByStock(params: Pick<ResinInventorySearch, 'query'>): Promise<Result<ResinStockCounts, AppError>>;

  abstract insert(resin: NewResin): Promise<Result<Resin, AppError>>;

  abstract update(resin: Resin): Promise<Result<void, AppError>>;

  /**
   * "Eliminar": borra la resina si nunca se vendió; si ya está en alguna venta la archiva
   * (función `remove_resin`, migración #26). Las archivadas no salen en el catálogo ni el inventario.
   */
  abstract remove(id: number): Promise<Result<RemoveOutcome, AppError>>;
}
