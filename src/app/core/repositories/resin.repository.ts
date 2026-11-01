import { AppError } from '../errors/app-error';
import { Page } from '../models/page';
import { Resin } from '../models/resin';
import { Result } from '../result';

export interface ResinSearch {
  query: string;
  /** Empieza en 1. */
  page: number;
  pageSize: number;
}

/** Contrato de resinas (= ResinRepository abstracto de Flutter, recortado al alcance de E2.6: sin alta/edición). */
export abstract class ResinRepository {
  /**
   * Busca en `descripcion` y `texto` (Flutter solo buscaba en `texto`, pero ahí no vive el nombre
   * que se muestra en el catálogo —`descripcion`—, así que escribir el nombre completo no
   * encontraba nada; corregido tras probar, 2026-10-31). Paginado para no traer el catálogo entero.
   */
  abstract search(params: ResinSearch): Promise<Result<Page<Resin>, AppError>>;
}
