import { Injectable, inject } from '@angular/core';
import { AppError, toAppError } from '../errors/app-error';
import { BranchSetting, BranchSettingsRepository } from '../repositories/branch-settings.repository';
import { Result, err, ok } from '../result';
import { SUPABASE } from '../supabase/supabase.client';

interface BranchSettingRow {
  sucursal: string;
  descuento_requiere_autorizacion: boolean;
}

@Injectable()
export class SupabaseBranchSettingsRepository extends BranchSettingsRepository {
  private readonly supabase = inject(SUPABASE);

  async list(): Promise<Result<BranchSetting[], AppError>> {
    const { data, error } = await this.supabase
      .from('sucursal_config')
      .select('sucursal, descuento_requiere_autorizacion');
    if (error) return err(toAppError(error));
    return ok(
      (data as BranchSettingRow[]).map((row) => ({
        branch: row.sucursal,
        discountRequiresAuth: row.descuento_requiere_autorizacion,
      })),
    );
  }

  async setDiscountRequiresAuth(branch: string, value: boolean): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.rpc('set_branch_discount_auth', { p_sucursal: branch, p_value: value });
    if (error) return err(toAppError(error));
    return ok(undefined);
  }
}
