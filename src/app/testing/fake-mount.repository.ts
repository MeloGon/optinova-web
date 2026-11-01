import { AppError } from '../core/errors/app-error';
import { Mount } from '../core/models/mount';
import { Page } from '../core/models/page';
import { MountRepository, MountSearch } from '../core/repositories/mount.repository';
import { Result, err, ok } from '../core/result';

export const fakeMount = (id: number, brand = 'RAY-BAN', stock = 5): Mount => ({
  id,
  brand,
  model: `MOD-${id}`,
  color: 'NEGRO',
  description: 'ACETATO COMPLETO',
  price: 300,
  branch: 'OFTALVISION',
  barcode: `750${id}`,
  stock,
});

/** MountRepository en memoria para tests. */
export class FakeMountRepository extends MountRepository {
  mounts: Mount[] = [];
  searchFailWith: AppError | null = null;
  decrementCalls: { id: number; quantity: number }[] = [];
  decrementFailWith: AppError | null = null;

  async search({ query, branch, page, pageSize }: MountSearch): Promise<Result<Page<Mount>, AppError>> {
    if (this.searchFailWith) return err(this.searchFailWith);
    const text = query.trim().toLowerCase();
    const matches = this.mounts.filter(
      (m) =>
        m.stock > 0 &&
        (!text || m.brand.toLowerCase().includes(text) || m.model.toLowerCase().includes(text)) &&
        (!branch || m.branch === branch),
    );
    const from = (page - 1) * pageSize;
    return ok({ items: matches.slice(from, from + pageSize), total: matches.length });
  }

  async decrementStock(id: number, quantity: number): Promise<Result<void, AppError>> {
    if (this.decrementFailWith) return err(this.decrementFailWith);
    this.decrementCalls.push({ id, quantity });
    this.mounts = this.mounts.map((m) => (m.id === id ? { ...m, stock: Math.max(m.stock - quantity, 0) } : m));
    return ok(undefined);
  }
}
