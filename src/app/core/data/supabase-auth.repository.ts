import { Injectable, inject } from '@angular/core';
import { AuthError, User } from '@supabase/supabase-js';
import { AppError, appError, toAppError } from '../errors/app-error';
import { Profile } from '../models/profile';
import { ROLES, Role } from '../models/role';
import { AuthRepository } from '../repositories/auth.repository';
import { Result, err, ok } from '../result';
import { SUPABASE } from '../supabase/supabase.client';

/** Fila de `perfiles` tal como viene de la DB. */
interface ProfileRow {
  id: string;
  nombre: string | null;
  sucursal: string | null;
  rol: string | null;
}

@Injectable()
export class SupabaseAuthRepository extends AuthRepository {
  private readonly supabase = inject(SUPABASE);

  async signIn(email: string, password: string): Promise<Result<Profile, AppError>> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) return err(authError(error));

    const profile = await this.loadProfile(data.user);
    if (!profile.ok) await this.supabase.auth.signOut();
    return profile;
  }

  async restoreSession(): Promise<Profile | null> {
    // getSession lee la sesión guardada en el navegador y renueva el token si venció.
    const { data } = await this.supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return null;
    const profile = await this.loadProfile(user);
    return profile.ok ? profile.value : null;
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
  }

  onSignedOut(callback: () => void): void {
    this.supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') callback();
    });
  }

  private async loadProfile(user: User): Promise<Result<Profile, AppError>> {
    const { data, error } = await this.supabase
      .from('perfiles')
      .select('id, nombre, sucursal, rol')
      .eq('id', user.id)
      .maybeSingle<ProfileRow>();

    if (error) return err(toAppError(error));
    if (!data) {
      return err(appError('notFound', 'Tu usuario no tiene perfil. Pide ayuda a tu administrador.'));
    }
    return ok({
      id: data.id,
      name: data.nombre ?? user.email ?? '',
      branch: data.sucursal ?? '',
      role: toRole(data.rol),
      email: user.email ?? '',
    });
  }
}

/** Un rol desconocido se trata como el de menor permiso. */
function toRole(value: string | null): Role {
  return ROLES.includes(value as Role) ? (value as Role) : 'vendedor';
}

/** Mensajes de Supabase Auth en español. */
function authError(error: AuthError): AppError {
  // supabase-js no lanza al fallar la red: devuelve este error.
  if (error.name === 'AuthRetryableFetchError') {
    return appError('network', 'Sin conexión. Revisa tu internet e inténtalo de nuevo.');
  }
  switch (error.code) {
    case 'invalid_credentials':
      return appError('unauthorized', 'Correo o contraseña incorrectos.');
    case 'email_not_confirmed':
      return appError('unauthorized', 'Tu correo aún no está confirmado. Pide ayuda a tu administrador.');
    case 'user_banned':
      return appError('unauthorized', 'Tu usuario está desactivado. Pide ayuda a tu administrador.');
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return appError('server', 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.');
  }
  return toAppError(error);
}
