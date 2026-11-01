import { AppError } from '../errors/app-error';
import { Mount } from '../models/mount';
import { Page } from '../models/page';
import { Result } from '../result';

export interface MountSearch {
  query: string;
  /** Filtro de sucursal del selector de monturas (no es la sucursal de la venta). */
  branch: string | null;
  /** Empieza en 1. */
  page: number;
  pageSize: number;
}

/** Contrato de armazones (= MountRepository abstracto de Flutter, recortado al alcance de E2.6: sin alta/edición). */
export abstract class MountRepository {
  /**
   * Busca por marca o modelo, solo con stock disponible (= catálogo de Vender), paginado para no
   * traer el inventario entero de una sola vez (pedido del dueño tras probar, 2026-10-31).
   * El filtro de sucursal es una mejora frente a Flutter: ahí era solo en memoria sobre lo ya
   * traído; acá se manda al servidor porque la columna ya está limpia.
   */
  abstract search(params: MountSearch): Promise<Result<Page<Mount>, AppError>>;

  /**
   * Resta `quantity` del stock (nunca baja de 0): lee el valor actual y escribe el nuevo, igual
   * de no-atómico que el `decrementStock` de Flutter (dos ventas del mismo armazón en el mismo
   * instante podrían pisarse; aceptable al tamaño de esta óptica, mismo riesgo que ya existía).
   * Mejora consciente frente a Flutter: ahí siempre resta exactamente 1, sin mirar cuántas
   * unidades se vendieron.
   */
  abstract decrementStock(id: number, quantity: number): Promise<Result<void, AppError>>;
}
