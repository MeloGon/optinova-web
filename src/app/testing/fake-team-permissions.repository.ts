import { AppError, appError } from '../core/errors/app-error';
import { TeamVendor } from '../core/models/team-vendor';
import { TeamPermissionsRepository } from '../core/repositories/team-permissions.repository';
import { Result, err, ok } from '../core/result';

export const fakeVendor = (id: string, name: string, branch: string, canChangeDate = false): TeamVendor => ({
  id,
  name,
  branch,
  canChangeDate,
});

/** TeamPermissionsRepository en memoria para tests. */
export class FakeTeamPermissionsRepository extends TeamPermissionsRepository {
  vendors: TeamVendor[] = [];
  listFailWith: AppError | null = null;
  /** Simula el rechazo de `set_vendor_change_date_permission` (rol insuficiente o fuera de sucursal). */
  setFailWith: AppError | null = null;
  setCalls: { vendorId: string; value: boolean }[] = [];

  async listVendors(): Promise<Result<TeamVendor[], AppError>> {
    if (this.listFailWith) return err(this.listFailWith);
    return ok(this.vendors);
  }

  async setChangeDatePermission(vendorId: string, value: boolean): Promise<Result<void, AppError>> {
    this.setCalls.push({ vendorId, value });
    if (this.setFailWith) return err(this.setFailWith);
    this.vendors = this.vendors.map((v) => (v.id === vendorId ? { ...v, canChangeDate: value } : v));
    return ok(undefined);
  }
}

export const fakeTeamPermissionsUnauthorized = (): AppError =>
  appError('unauthorized', 'Solo puedes administrar vendedores de tu sucursal');
