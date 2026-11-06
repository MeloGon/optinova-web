import { AppError } from '../core/errors/app-error';
import { DiscountAuthorizationRepository } from '../core/repositories/discount-authorization.repository';
import { Result, err, ok } from '../core/result';

/** DiscountAuthorizationRepository en memoria para tests. */
export class FakeDiscountAuthorizationRepository extends DiscountAuthorizationRepository {
  failWith: AppError | null = null;
  calls: { email: string; password: string; amount: number }[] = [];

  async authorize(email: string, password: string, amount: number): Promise<Result<void, AppError>> {
    this.calls.push({ email, password, amount });
    if (this.failWith) return err(this.failWith);
    return ok(undefined);
  }
}
