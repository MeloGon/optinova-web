import { Injectable, inject } from '@angular/core';
import { AppError, toAppError } from '../errors/app-error';
import {
  PatientLifecycleRepository,
  PatientLifecycleResult,
  PatientLifecycleStatus,
  SupervisorCredentials,
} from '../repositories/patient-lifecycle.repository';
import { Result, err, ok } from '../result';
import { SUPABASE } from '../supabase/supabase.client';

/** Lo que devuelve el Edge Function cuando algo sale mal: `{ error: "mensaje para el usuario" }`. */
interface FunctionErrorBody {
  error?: string;
}

@Injectable()
export class SupabasePatientLifecycleRepository extends PatientLifecycleRepository {
  private readonly supabase = inject(SUPABASE);

  async resolve(patientId: string): Promise<Result<PatientLifecycleStatus, AppError>> {
    return this.invoke<PatientLifecycleStatus>({ action: 'resolve', patientId });
  }

  async apply(
    patientId: string,
    supervisor?: SupervisorCredentials,
  ): Promise<Result<PatientLifecycleResult, AppError>> {
    return this.invoke<PatientLifecycleResult>({
      action: 'apply',
      patientId,
      supervisorEmail: supervisor?.email,
      supervisorPassword: supervisor?.password,
    });
  }

  async restore(patientId: string): Promise<Result<void, AppError>> {
    return this.invoke<void>({ action: 'restore', patientId });
  }

  /**
   * `functions.invoke` no lee el cuerpo `{ error: "..." }` que manda nuestro Edge Function en un
   * error: solo trae el `Response` crudo en `error.context`. Se lee a mano para mostrar el mensaje
   * real (p. ej. "Correo o contraseña incorrectos.") en vez del genérico de supabase-js.
   */
  private async invoke<T>(body: Record<string, unknown>): Promise<Result<T, AppError>> {
    const { data, error } = await this.supabase.functions.invoke<T>('patients-lifecycle', { body });
    if (!error) return ok(data as T);

    const context = (error as { context?: Response }).context;
    let message = error.message;
    const status = context?.status;
    if (context) {
      const parsed = (await context.json().catch(() => null)) as FunctionErrorBody | null;
      if (parsed?.error) message = parsed.error;
    }
    return err(toAppError({ status, message }));
  }
}
