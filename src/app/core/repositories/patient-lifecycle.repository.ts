import { AppError } from '../errors/app-error';
import { Result } from '../result';

/** A qué nivel pertenece el paciente según su historial (lo decide siempre el servidor). */
export type PatientTier = 'none' | 'reviews' | 'sales';

export interface PatientLifecycleStatus {
  tier: PatientTier;
  reviewCount: number;
  saleCount: number;
}

/** Credenciales de un supervisor+ (P-04), solo para el nivel `reviews` cuando llama un vendedor. */
export interface SupervisorCredentials {
  email: string;
  password: string;
}

export type PatientLifecycleResult = { result: 'deleted' } | { result: 'archived' };

/**
 * Eliminar/archivar paciente por historial (= PatientLifecycleRepository abstracto, sin
 * equivalente en Flutter: esa app no tenía esta regla). A diferencia del resto de `PatientRepository`,
 * no habla con `pacientes` directo: todo pasa por el Edge Function `patients-lifecycle`
 * (`service_role`), el único que puede borrar o archivar/restaurar (ver migración #11).
 */
export abstract class PatientLifecycleRepository {
  /** Solo lectura: en qué nivel está el paciente, para que la pantalla elija el diálogo correcto. */
  abstract resolve(patientId: string): Promise<Result<PatientLifecycleStatus, AppError>>;

  /**
   * Vuelve a calcular el nivel en el servidor (nunca confía en lo que decidió la pantalla) y
   * borra o archiva según corresponda. `supervisor` solo hace falta si el nivel es `reviews` y
   * quien llama es vendedor.
   */
  abstract apply(
    patientId: string,
    supervisor?: SupervisorCredentials,
  ): Promise<Result<PatientLifecycleResult, AppError>>;

  /** Admin+ únicamente: limpia el archivado y el paciente vuelve a aparecer en búsquedas y Vender. */
  abstract restore(patientId: string): Promise<Result<void, AppError>>;
}
