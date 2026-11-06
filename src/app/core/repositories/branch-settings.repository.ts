import { AppError } from '../errors/app-error';
import { Result } from '../result';

/** Ajustes de una sucursal (hoy solo la regla de descuentos; la sucursal sigue siendo texto hasta la Fase 4b). */
export interface BranchSetting {
  branch: string;
  /** Si es `true`, un vendedor necesita la autorización de un supervisor para dar descuento. */
  discountRequiresAuth: boolean;
}

/**
 * Ajustes por sucursal (= tabla `sucursal_config`). Lectura abierta a cualquier autenticado
 * (Vender necesita saber si pedir permiso); la escritura pasa por `set_branch_discount_auth`, que
 * limita al supervisor a su propia sucursal. Una sucursal sin fila usa los valores por defecto
 * (descuento libre).
 */
export abstract class BranchSettingsRepository {
  abstract list(): Promise<Result<BranchSetting[], AppError>>;

  abstract setDiscountRequiresAuth(branch: string, value: boolean): Promise<Result<void, AppError>>;
}
