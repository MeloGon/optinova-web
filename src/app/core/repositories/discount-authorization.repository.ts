import { AppError } from '../errors/app-error';
import { Result } from '../result';

/**
 * Autorización de un descuento por un supervisor+ (P-04 en Vender). El Edge Function
 * `authorize-discount` verifica las credenciales y deja una autorización de un solo uso (hasta
 * `amount`, 10 minutos); el trigger de `ventas` la consume al guardar la venta.
 */
export abstract class DiscountAuthorizationRepository {
  abstract authorize(email: string, password: string, amount: number): Promise<Result<void, AppError>>;
}
