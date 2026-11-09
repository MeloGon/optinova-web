import { AppError, appError } from '../core/errors/app-error';
import { ManagedBranch } from '../core/models/managed-branch';
import { BranchAdminRepository, BranchEdit, NewCompany } from '../core/repositories/branch-admin.repository';
import { Result, err, ok } from '../core/result';

export const fakeManagedBranch = (id: number, name = `SUCURSAL ${id}`, active = true): ManagedBranch => ({
  id,
  name,
  active,
  companyId: 'org-1',
  companyName: 'Inversiones Oftalvision',
});

/** BranchAdminRepository en memoria para tests. */
export class FakeBranchAdminRepository extends BranchAdminRepository {
  branches: ManagedBranch[] = [];

  listFailWith: AppError | null = null;
  createFailWith: AppError | null = null;
  updateFailWith: AppError | null = null;
  createCompanyFailWith: AppError | null = null;
  companiesCreated: NewCompany[] = [];
  private nextId = 1000;

  async list(): Promise<Result<ManagedBranch[], AppError>> {
    if (this.listFailWith) return err(this.listFailWith);
    return ok(this.branches);
  }

  async create(name: string, companyId = 'org-1'): Promise<Result<void, AppError>> {
    if (this.createFailWith) return err(this.createFailWith);
    this.branches = [
      ...this.branches,
      { id: this.nextId++, name: name.trim().toUpperCase(), active: true, companyId, companyName: 'Inversiones Oftalvision' },
    ];
    return ok(undefined);
  }

  async update(id: number, edit: BranchEdit): Promise<Result<void, AppError>> {
    if (this.updateFailWith) return err(this.updateFailWith);
    if (!this.branches.some((b) => b.id === id)) return err(appError('notFound', 'Sucursal no encontrada'));
    this.branches = this.branches.map((b) =>
      b.id === id ? { ...b, name: edit.name?.trim().toUpperCase() ?? b.name, active: edit.active ?? b.active } : b,
    );
    return ok(undefined);
  }

  async createCompany(draft: NewCompany): Promise<Result<void, AppError>> {
    if (this.createCompanyFailWith) return err(this.createCompanyFailWith);
    this.companiesCreated.push(draft);
    this.branches = [
      ...this.branches,
      { id: this.nextId++, name: draft.branch.trim().toUpperCase(), active: true, companyId: `org-${this.nextId}`, companyName: draft.name },
    ];
    return ok(undefined);
  }
}
