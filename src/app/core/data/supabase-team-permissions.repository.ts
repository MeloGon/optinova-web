import { Injectable, inject } from '@angular/core';
import { AppError, toAppError } from '../errors/app-error';
import { TeamVendor } from '../models/team-vendor';
import { TeamPermissionsRepository } from '../repositories/team-permissions.repository';
import { Result, err, ok } from '../result';
import { SUPABASE } from '../supabase/supabase.client';

interface TeamVendorRow {
  id: string;
  nombre: string | null;
  sucursal: string | null;
  puedeCambiarFecha: boolean;
}

function toVendor(row: TeamVendorRow): TeamVendor {
  return { id: row.id, name: row.nombre ?? '', branch: row.sucursal ?? '', canChangeDate: row.puedeCambiarFecha };
}

@Injectable()
export class SupabaseTeamPermissionsRepository extends TeamPermissionsRepository {
  private readonly supabase = inject(SUPABASE);

  async listVendors(): Promise<Result<TeamVendor[], AppError>> {
    const { data, error } = await this.supabase.rpc('list_team_vendors');
    if (error) return err(toAppError(error));
    return ok((data as TeamVendorRow[]).map(toVendor));
  }

  async setChangeDatePermission(vendorId: string, value: boolean): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.rpc('set_vendor_change_date_permission', {
      p_vendor_id: vendorId,
      p_value: value,
    });
    if (error) return err(toAppError(error));
    return ok(undefined);
  }
}
