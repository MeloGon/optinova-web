import { Injectable, inject } from '@angular/core';
import { AppError, toAppError } from '../errors/app-error';
import { ManagedUser } from '../models/managed-user';
import { Role } from '../models/role';
import { ManagedUserEdit, NewManagedUser, UserAdminRepository } from '../repositories/user-admin.repository';
import { Result, err, ok } from '../result';
import { SUPABASE } from '../supabase/supabase.client';

interface ManagedUserRow {
  id: string;
  nombre: string | null;
  sucursal: string | null;
  rol: string;
  email: string | null;
  last_sign_in_at: string | null;
  active: boolean;
}

/** Lo que devuelve el Edge Function cuando algo sale mal: `{ error: "mensaje para el usuario" }`. */
interface FunctionErrorBody {
  error?: string;
}

function toManagedUser(row: ManagedUserRow): ManagedUser {
  return {
    id: row.id,
    name: row.nombre ?? '',
    branch: row.sucursal,
    role: row.rol as Role,
    email: row.email ?? '',
    lastSignInAt: row.last_sign_in_at,
    active: row.active,
  };
}

@Injectable()
export class SupabaseUserAdminRepository extends UserAdminRepository {
  private readonly supabase = inject(SUPABASE);

  async list(): Promise<Result<ManagedUser[], AppError>> {
    const result = await this.invoke<{ users: ManagedUserRow[] }>({ action: 'list' });
    if (!result.ok) return result;
    return ok(result.value.users.map(toManagedUser));
  }

  async create(draft: NewManagedUser): Promise<Result<ManagedUser, AppError>> {
    const result = await this.invoke<{ user: ManagedUserRow }>({
      action: 'create',
      nombre: draft.name,
      sucursal: draft.branch,
      rol: draft.role,
      email: draft.email,
      password: draft.password,
    });
    if (!result.ok) return result;
    return ok(toManagedUser(result.value.user));
  }

  async update(userId: string, draft: ManagedUserEdit): Promise<Result<void, AppError>> {
    const result = await this.invoke<{ ok: true }>({
      action: 'update',
      userId,
      nombre: draft.name,
      sucursal: draft.branch,
      rol: draft.role,
    });
    if (!result.ok) return result;
    return ok(undefined);
  }

  async setActive(userId: string, active: boolean): Promise<Result<void, AppError>> {
    const result = await this.invoke<{ ok: true }>({ action: 'set_active', userId, active });
    if (!result.ok) return result;
    return ok(undefined);
  }

  async resetPassword(userId: string, newPassword: string): Promise<Result<void, AppError>> {
    const result = await this.invoke<{ ok: true }>({ action: 'reset_password', userId, newPassword });
    if (!result.ok) return result;
    return ok(undefined);
  }

  /**
   * `functions.invoke` no lee el cuerpo `{ error: "..." }` que manda nuestro Edge Function en un
   * error: solo trae el `Response` crudo en `error.context`. Se lee a mano para mostrar el mensaje
   * real (p. ej. "Debe quedar al menos un megadmin activo.") en vez del genérico de supabase-js.
   */
  private async invoke<T>(body: Record<string, unknown>): Promise<Result<T, AppError>> {
    const { data, error } = await this.supabase.functions.invoke<T>('megadmin-users', { body });
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
