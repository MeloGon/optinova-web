import { AppError } from '../errors/app-error';
import { Profile } from '../models/profile';
import { Result } from '../result';

/**
 * Contrato de autenticación (= repositorio abstracto de Flutter).
 * Hoy lo implementa Supabase; con NestJS (Fase 6) solo cambia la implementación.
 */
export abstract class AuthRepository {
  /** Inicia sesión y devuelve el perfil. */
  abstract signIn(email: string, password: string): Promise<Result<Profile, AppError>>;

  /** Perfil de la sesión guardada en el navegador, o null si no hay sesión válida. */
  abstract restoreSession(): Promise<Profile | null>;

  abstract signOut(): Promise<void>;

  /** Avisa cuando la sesión termina sola (token vencido, cierre en otra pestaña). */
  abstract onSignedOut(callback: () => void): void;
}
