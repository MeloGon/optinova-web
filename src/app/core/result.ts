/**
 * Resultado de una operación que puede fallar (= Either<L, R> de fpdart).
 * `ok: true` = Right(value) · `ok: false` = Left(error).
 *
 *   const r = await repo.getPatients();
 *   if (r.ok) { r.value } else { r.error }   // = r.fold((e) => ..., (v) => ...)
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

/** = Right(value) */
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

/** = Left(error) */
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
