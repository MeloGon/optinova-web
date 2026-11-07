import { AppError } from '../errors/app-error';
import { Mount } from '../models/mount';
import { Page } from '../models/page';
import { RemoveOutcome } from '../models/remove-outcome';
import { StockStatus } from '../models/stock-status';
import { Result } from '../result';

export interface MountSearch {
  query: string;
  /** Filtro de sucursal del selector de monturas (no es la sucursal de la venta). */
  branch: string | null;
  /** Empieza en 1. */
  page: number;
  pageSize: number;
}

export interface MountInventorySearch {
  query: string;
  branch: string | null;
  /** "low" = 1 o 2 unidades (mismo umbral que el Dashboard); "out" = 0. */
  stockStatus: StockStatus;
  /** Empieza en 1. */
  page: number;
  pageSize: number;
}

export interface MountStockCounts {
  all: number;
  low: number;
  out: number;
}

export type NewMount = Omit<Mount, 'id'>;

/** Contrato de armazones. */
export abstract class MountRepository {
  /**
   * Busca por marca o modelo, solo con stock disponible (= catálogo de Vender), paginado para no
   * traer el inventario entero de una sola vez (pedido del dueño tras probar, 2026-10-31).
   * El filtro de sucursal es una mejora frente a Flutter: ahí era solo en memoria sobre lo ya
   * traído; acá se manda al servidor porque la columna ya está limpia.
   */
  abstract search(params: MountSearch): Promise<Result<Page<Mount>, AppError>>;

  /** Listado completo para Settings · Armazones (incluye agotados; `search` nunca los necesitaba). */
  abstract listInventory(params: MountInventorySearch): Promise<Result<Page<Mount>, AppError>>;

  abstract countByStock(params: Pick<MountInventorySearch, 'query' | 'branch'>): Promise<Result<MountStockCounts, AppError>>;

  abstract insert(mount: NewMount): Promise<Result<Mount, AppError>>;

  abstract update(mount: Mount): Promise<Result<void, AppError>>;

  /**
   * "Eliminar": borra el armazón si nunca se vendió; si ya está en alguna venta lo archiva
   * (función `remove_mount`, migración #26). Los archivados no salen en el catálogo, el inventario
   * ni el Dashboard. El descuento de stock al vender ya no vive acá: lo hace `SaleRepository.create`.
   */
  abstract remove(id: string): Promise<Result<RemoveOutcome, AppError>>;
}
