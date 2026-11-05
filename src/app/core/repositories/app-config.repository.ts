import { AppError } from '../errors/app-error';
import { AppFeature } from '../models/app-feature';
import { Result } from '../result';

/**
 * Contrato de `app_config` (= AppConfigRepository de Flutter: una tabla llave/valor con
 * interruptores de la app). Lectura abierta a cualquier autenticado (toda la app necesita leer
 * los flags, sin importar su rol); la escritura la restringe RLS a admin+ (cambio #21).
 */
export abstract class AppConfigRepository {
  abstract list(): Promise<Result<AppFeature[], AppError>>;

  abstract setValue(key: string, value: boolean): Promise<Result<void, AppError>>;
}
