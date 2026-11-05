import { AppError, appError } from '../core/errors/app-error';
import { Mount } from '../core/models/mount';
import { Page } from '../core/models/page';
import {
  MountInventorySearch,
  MountRepository,
  MountSearch,
  MountStockCounts,
  NewMount,
} from '../core/repositories/mount.repository';
import { Result, err, ok } from '../core/result';

export const fakeMount = (id: number, brand = 'RAY-BAN', stock = 5): Mount => ({
  id: String(id),
  brand,
  model: `MOD-${id}`,
  color: 'NEGRO',
  description: 'ACETATO COMPLETO',
  price: 300,
  branch: 'OFTALVISION',
  barcode: `750${id}`,
  stock,
});

function matchesStock(mount: Mount, status: MountInventorySearch['stockStatus']): boolean {
  if (status === 'low') return mount.stock >= 1 && mount.stock <= 2;
  if (status === 'out') return mount.stock === 0;
  return true;
}

/** MountRepository en memoria para tests. */
export class FakeMountRepository extends MountRepository {
  mounts: Mount[] = [];
  searchFailWith: AppError | null = null;
  decrementCalls: { id: string; quantity: number }[] = [];
  decrementFailWith: AppError | null = null;

  insertFailWith: AppError | null = null;
  updateFailWith: AppError | null = null;
  deleteFailWith: AppError | null = null;
  private nextId = 1000;

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

  async listInventory({ query, branch, stockStatus, page, pageSize }: MountInventorySearch): Promise<Result<Page<Mount>, AppError>> {
    if (this.searchFailWith) return err(this.searchFailWith);
    const text = query.trim().toLowerCase();
    const matches = this.mounts
      .filter(
        (m) =>
          (!text || m.brand.toLowerCase().includes(text) || m.model.toLowerCase().includes(text)) &&
          (!branch || m.branch === branch) &&
          matchesStock(m, stockStatus),
      )
      .sort((a, b) => a.stock - b.stock);
    const from = (page - 1) * pageSize;
    return ok({ items: matches.slice(from, from + pageSize), total: matches.length });
  }

  async countByStock({ query, branch }: Pick<MountInventorySearch, 'query' | 'branch'>): Promise<Result<MountStockCounts, AppError>> {
    const text = query.trim().toLowerCase();
    const matches = this.mounts.filter(
      (m) => (!text || m.brand.toLowerCase().includes(text) || m.model.toLowerCase().includes(text)) && (!branch || m.branch === branch),
    );
    return ok({
      all: matches.length,
      low: matches.filter((m) => matchesStock(m, 'low')).length,
      out: matches.filter((m) => matchesStock(m, 'out')).length,
    });
  }

  async insert(mount: NewMount): Promise<Result<Mount, AppError>> {
    if (this.insertFailWith) return err(this.insertFailWith);
    const saved: Mount = { ...mount, id: String(this.nextId++) };
    this.mounts = [...this.mounts, saved];
    return ok(saved);
  }

  async update(mount: Mount): Promise<Result<void, AppError>> {
    if (this.updateFailWith) return err(this.updateFailWith);
    if (!this.mounts.some((m) => m.id === mount.id)) return err(appError('notFound', 'El armazón ya no existe.'));
    this.mounts = this.mounts.map((m) => (m.id === mount.id ? mount : m));
    return ok(undefined);
  }

  async delete(id: string): Promise<Result<void, AppError>> {
    if (this.deleteFailWith) return err(this.deleteFailWith);
    if (!this.mounts.some((m) => m.id === id)) return err(appError('notFound', 'El armazón ya no existe.'));
    this.mounts = this.mounts.filter((m) => m.id !== id);
    return ok(undefined);
  }

  async decrementStock(id: string, quantity: number): Promise<Result<void, AppError>> {
    if (this.decrementFailWith) return err(this.decrementFailWith);
    this.decrementCalls.push({ id, quantity });
    this.mounts = this.mounts.map((m) => (m.id === id ? { ...m, stock: Math.max(m.stock - quantity, 0) } : m));
    return ok(undefined);
  }
}
