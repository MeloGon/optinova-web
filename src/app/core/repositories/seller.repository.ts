import { AppError } from '../errors/app-error';
import { Seller } from '../models/seller';
import { Result } from '../result';

/** Contrato de vendedores (= `_getSellers` de Flutter; tabla `vendedores`). */
export abstract class SellerRepository {
  abstract list(): Promise<Result<Seller[], AppError>>;
}
