import { AppError, appError } from '../core/errors/app-error';
import { ManagedUser } from '../core/models/managed-user';
import { ManagedUserEdit, NewManagedUser, UserAdminRepository } from '../core/repositories/user-admin.repository';
import { Result, err, ok } from '../core/result';

export const fakeManagedUser = (id: string, role: ManagedUser['role'] = 'vendedor'): ManagedUser => ({
  id,
  name: `Usuario ${id}`,
  branch: 'OFTALVISION',
  role,
  email: `${id}@optinova.test`,
  lastSignInAt: null,
  active: true,
});

/** UserAdminRepository en memoria para tests. */
export class FakeUserAdminRepository extends UserAdminRepository {
  users: ManagedUser[] = [];

  listFailWith: AppError | null = null;
  createFailWith: AppError | null = null;
  updateFailWith: AppError | null = null;
  setActiveFailWith: AppError | null = null;
  resetPasswordFailWith: AppError | null = null;
  resetPasswordCalls: { userId: string; newPassword: string }[] = [];
  private nextId = 1000;

  async list(): Promise<Result<ManagedUser[], AppError>> {
    if (this.listFailWith) return err(this.listFailWith);
    return ok(this.users);
  }

  async create(draft: NewManagedUser): Promise<Result<ManagedUser, AppError>> {
    if (this.createFailWith) return err(this.createFailWith);
    const saved: ManagedUser = {
      id: `new-${this.nextId++}`,
      name: draft.name,
      branch: draft.branch,
      role: draft.role,
      email: draft.email,
      lastSignInAt: null,
      active: true,
    };
    this.users = [...this.users, saved];
    return ok(saved);
  }

  async update(userId: string, draft: ManagedUserEdit): Promise<Result<void, AppError>> {
    if (this.updateFailWith) return err(this.updateFailWith);
    if (!this.users.some((u) => u.id === userId)) return err(appError('notFound', 'Usuario no encontrado.'));
    this.users = this.users.map((u) => (u.id === userId ? { ...u, ...draft } : u));
    return ok(undefined);
  }

  async setActive(userId: string, active: boolean): Promise<Result<void, AppError>> {
    if (this.setActiveFailWith) return err(this.setActiveFailWith);
    this.users = this.users.map((u) => (u.id === userId ? { ...u, active } : u));
    return ok(undefined);
  }

  async resetPassword(userId: string, newPassword: string): Promise<Result<void, AppError>> {
    this.resetPasswordCalls.push({ userId, newPassword });
    if (this.resetPasswordFailWith) return err(this.resetPasswordFailWith);
    return ok(undefined);
  }
}
