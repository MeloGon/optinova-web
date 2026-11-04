import { AppError, appError } from '../core/errors/app-error';
import { Page } from '../core/models/page';
import { Resin } from '../core/models/resin';
import {
  NewResin,
  ResinInventorySearch,
  ResinRepository,
  ResinSearch,
  ResinStockCounts,
} from '../core/repositories/resin.repository';
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

function matchesStock(resin: Resin, status: ResinInventorySearch['stockStatus']): boolean {
  if (status === 'low') return resin.quantity >= 1 && resin.quantity <= 2;
  if (status === 'out') return resin.quantity === 0;
  return true;
}

/** ResinRepository en memoria para tests. */
export class FakeResinRepository extends ResinRepository {
  resins: Resin[] = [];
  searchFailWith: AppError | null = null;

  insertFailWith: AppError | null = null;
  updateFailWith: AppError | null = null;
  deleteFailWith: AppError | null = null;
  private nextId = 1000;

  async search({ query, page, pageSize }: ResinSearch): Promise<Result<Page<Resin>, AppError>> {
    if (this.searchFailWith) return err(this.searchFailWith);
    const text = query.trim().toLowerCase();
    const matches = this.resins.filter(
      (r) => !text || r.description.toLowerCase().includes(text) || r.text.toLowerCase().includes(text),
    );
    const from = (page - 1) * pageSize;
    return ok({ items: matches.slice(from, from + pageSize), total: matches.length });
  }

  async listInventory({ query, stockStatus, page, pageSize }: ResinInventorySearch): Promise<Result<Page<Resin>, AppError>> {
    if (this.searchFailWith) return err(this.searchFailWith);
    const text = query.trim().toLowerCase();
    const matches = this.resins
      .filter(
        (r) =>
          (!text || r.description.toLowerCase().includes(text) || r.text.toLowerCase().includes(text)) &&
          matchesStock(r, stockStatus),
      )
      .sort((a, b) => a.quantity - b.quantity);
    const from = (page - 1) * pageSize;
    return ok({ items: matches.slice(from, from + pageSize), total: matches.length });
  }

  async countByStock({ query }: Pick<ResinInventorySearch, 'query'>): Promise<Result<ResinStockCounts, AppError>> {
    const text = query.trim().toLowerCase();
    const matches = this.resins.filter(
      (r) => !text || r.description.toLowerCase().includes(text) || r.text.toLowerCase().includes(text),
    );
    return ok({
      all: matches.length,
      low: matches.filter((r) => matchesStock(r, 'low')).length,
      out: matches.filter((r) => matchesStock(r, 'out')).length,
    });
  }

  async insert(resin: NewResin): Promise<Result<Resin, AppError>> {
    if (this.insertFailWith) return err(this.insertFailWith);
    const text = [resin.description, resin.design, resin.line, resin.material, resin.technology].filter(Boolean).join(' ');
    const saved: Resin = { ...resin, text, id: this.nextId++ };
    this.resins = [...this.resins, saved];
    return ok(saved);
  }

  async update(resin: Resin): Promise<Result<void, AppError>> {
    if (this.updateFailWith) return err(this.updateFailWith);
    if (!this.resins.some((r) => r.id === resin.id)) return err(appError('notFound', 'La resina ya no existe.'));
    this.resins = this.resins.map((r) => (r.id === resin.id ? resin : r));
    return ok(undefined);
  }

  async delete(id: number): Promise<Result<void, AppError>> {
    if (this.deleteFailWith) return err(this.deleteFailWith);
    if (!this.resins.some((r) => r.id === id)) return err(appError('notFound', 'La resina ya no existe.'));
    this.resins = this.resins.filter((r) => r.id !== id);
    return ok(undefined);
  }
}
