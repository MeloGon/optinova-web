/**
 * Errores de la app (= sealed class Failure de freezed en Flutter).
 * `kind` distingue el caso, como el factory de freezed; `message` es para mostrar.
 */
export type AppErrorKind = 'server' | 'network' | 'notFound' | 'unauthorized' | 'unknown';

export interface AppError {
  kind: AppErrorKind;
  message: string;
}

export const appError = (kind: AppErrorKind, message: string): AppError => ({ kind, message });

/** Forma común de los errores de supabase-js (PostgrestError, AuthError, FunctionsError). */
interface SupabaseLikeError {
  message?: string;
  code?: string;
  status?: number;
}

/**
 * Convierte cualquier error (de Supabase, de red o desconocido) en un AppError.
 * Equivale al `catch (e) { return Left(Failure.server(e.toString())); }` de los repos Flutter,
 * pero distinguiendo el caso.
 */
export function toAppError(error: unknown): AppError {
  // fetch lanza TypeError cuando no hay conexión.
  if (error instanceof TypeError) {
    return appError('network', 'Sin conexión. Revisa tu internet e inténtalo de nuevo.');
  }

  const e = (error ?? {}) as SupabaseLikeError;
  const message = e.message || 'Ocurrió un error inesperado.';

  // PGRST116: .single() no encontró filas.
  if (e.code === 'PGRST116' || e.status === 404) return appError('notFound', message);
  // 42501: RLS denegó la operación. 401/403: sesión vencida o sin permisos.
  if (e.code === '42501' || e.status === 401 || e.status === 403) {
    return appError('unauthorized', message);
  }
  if (e.code || e.status) return appError('server', message);
  return appError('unknown', message);
}
