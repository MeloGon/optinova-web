import { Injectable, inject } from '@angular/core';
import { AppError, appError, toAppError } from '../errors/app-error';
import { AppFeature } from '../models/app-feature';
import { AppConfigRepository } from '../repositories/app-config.repository';
import { Result, err, ok } from '../result';
import { SUPABASE } from '../supabase/supabase.client';

interface AppConfigRow {
  key: string;
  value: string;
  description: string | null;
}

function toFeature(row: AppConfigRow): AppFeature {
  return { key: row.key, value: row.value === 'true', description: row.description ?? '' };
}

@Injectable()
export class SupabaseAppConfigRepository extends AppConfigRepository {
  private readonly supabase = inject(SUPABASE);

  async list(): Promise<Result<AppFeature[], AppError>> {
    const { data, error } = await this.supabase
      .from('app_config')
      .select('key, value, description')
      .order('key')
      .overrideTypes<AppConfigRow[], { merge: false }>();
    if (error) return err(toAppError(error));
    return ok(data.map(toFeature));
  }

  async setValue(key: string, value: boolean): Promise<Result<void, AppError>> {
    const { data, error } = await this.supabase
      .from('app_config')
      .update({ value: String(value) })
      .eq('key', key)
      .select('key');
    if (error) return err(toAppError(error));
    // RLS (cambio #21) rechaza en silencio a quien no sea admin+: 0 filas, sin error.
    if (data.length === 0) return err(appError('unauthorized', 'No tienes permiso para cambiar esta función.'));
    return ok(undefined);
  }
}
