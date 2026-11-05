import { AppError } from '../errors/app-error';
import { Mount } from '../models/mount';
import { Page } from '../models/page';
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

  abstract delete(id: string): Promise<Result<void, AppError>>;

  /**
   * Resta `quantity` del stock (nunca baja de 0): lee el valor actual y escribe el nuevo, igual
   * de no-atómico que el `decrementStock` de Flutter (dos ventas del mismo armazón en el mismo
   * instante podrían pisarse; aceptable al tamaño de esta óptica, mismo riesgo que ya existía).
   * Mejora consciente frente a Flutter: ahí siempre resta exactamente 1, sin mirar cuántas
   * unidades se vendieron.
   */
  abstract decrementStock(id: string, quantity: number): Promise<Result<void, AppError>>;
}
