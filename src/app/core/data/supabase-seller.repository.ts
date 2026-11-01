import { Injectable, inject } from '@angular/core';
import { AppError, toAppError } from '../errors/app-error';
import { Seller } from '../models/seller';
import { SellerRepository } from '../repositories/seller.repository';
import { Result, err, ok } from '../result';
import { SUPABASE } from '../supabase/supabase.client';

interface SellerRow {
  id: number;
  nombre: string | null;
}

@Injectable()
export class SupabaseSellerRepository extends SellerRepository {
  private readonly supabase = inject(SUPABASE);

  async list(): Promise<Result<Seller[], AppError>> {
    const { data, error } = await this.supabase
      .from('vendedores')
      .select('id, nombre')
      .order('nombre')
      .overrideTypes<SellerRow[], { merge: false }>();

    if (error) return err(toAppError(error));
    return ok(data.map((row) => ({ id: row.id, name: row.nombre ?? '' })));
  }
}
