import { AppError } from '../errors/app-error';
import { TeamVendor } from '../models/team-vendor';
import { Result } from '../result';

/**
 * Permiso individual "cambiar fecha de venta" por vendedor (= `puede_cambiar_fecha`).
 * El alcance lo decide el servidor (`list_team_vendors` / `set_vendor_change_date_permission`):
 * un supervisor solo ve/toca a los vendedores de su propia sucursal; admin/megadmin, a todos.
 */
export abstract class TeamPermissionsRepository {
  abstract listVendors(): Promise<Result<TeamVendor[], AppError>>;

  abstract setChangeDatePermission(vendorId: string, value: boolean): Promise<Result<void, AppError>>;
}
