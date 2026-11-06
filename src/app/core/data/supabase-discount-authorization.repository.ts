import { Injectable, inject } from '@angular/core';
import { AppError, toAppError } from '../errors/app-error';
import { DiscountAuthorizationRepository } from '../repositories/discount-authorization.repository';
import { Result, err, ok } from '../result';
import { SUPABASE } from '../supabase/supabase.client';

interface FunctionErrorBody {
  error?: string;
}

@Injectable()
export class SupabaseDiscountAuthorizationRepository extends DiscountAuthorizationRepository {
  private readonly supabase = inject(SUPABASE);

  /**
   * Igual que `patients-lifecycle`: `functions.invoke` no expone el cuerpo `{ error }` del Edge
   * Function, solo el `Response` crudo en `error.context`; se lee a mano para mostrar el mensaje
   * real ("Correo o contraseña incorrectos.", "Ese supervisor es de otra sucursal.").
   */
  async authorize(email: string, password: string, amount: number): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.functions.invoke('authorize-discount', {
      body: { supervisorEmail: email, supervisorPassword: password, amount },
    });
    if (!error) return ok(undefined);

    const context = (error as { context?: Response }).context;
    let message = error.message;
    if (context) {
      const parsed = (await context.json().catch(() => null)) as FunctionErrorBody | null;
      if (parsed?.error) message = parsed.error;
    }
    return err(toAppError({ status: context?.status, message }));
  }
}
