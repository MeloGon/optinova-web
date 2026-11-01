import { AppError } from '../core/errors/app-error';
import { Page } from '../core/models/page';
import { Resin } from '../core/models/resin';
import { ResinRepository, ResinSearch } from '../core/repositories/resin.repository';
import { Result, err, ok } from '../core/result';

export const fakeResin = (id: number, description = `RESINA ${id}`): Resin => ({
  id,
  description,
  design: 'MONOFOCAL',
  line: 'ESTANDAR',
  material: 'CR-39',
  technology: 'ANTIRREFLEJANTE',
  text: description,
  quantity: 10,
  price: 400,
  priceInternal: 200,
});

/** ResinRepository en memoria para tests. */
export class FakeResinRepository extends ResinRepository {
  resins: Resin[] = [];
  searchFailWith: AppError | null = null;

  async search({ query, page, pageSize }: ResinSearch): Promise<Result<Page<Resin>, AppError>> {
    if (this.searchFailWith) return err(this.searchFailWith);
    const text = query.trim().toLowerCase();
    const matches = this.resins.filter(
      (r) => !text || r.description.toLowerCase().includes(text) || r.text.toLowerCase().includes(text),
    );
    const from = (page - 1) * pageSize;
    return ok({ items: matches.slice(from, from + pageSize), total: matches.length });
  }
}
