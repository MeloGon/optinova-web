import { AppError } from '../core/errors/app-error';
import { Seller } from '../core/models/seller';
import { SellerRepository } from '../core/repositories/seller.repository';
import { Result, err, ok } from '../core/result';

export const fakeSeller = (id: number, name = `VENDEDOR ${id}`): Seller => ({ id, name });

/** SellerRepository en memoria para tests. */
export class FakeSellerRepository extends SellerRepository {
  sellers: Seller[] = [];
  listFailWith: AppError | null = null;

  async list(): Promise<Result<Seller[], AppError>> {
    if (this.listFailWith) return err(this.listFailWith);
    return ok(this.sellers);
  }
}
