import { Injectable, inject } from '@angular/core';
import { AppError, appError, toAppError } from '../errors/app-error';
import { Mount } from '../models/mount';
import { Page } from '../models/page';
import { MountInventorySearch, MountRepository, MountSearch, MountStockCounts, NewMount } from '../repositories/mount.repository';
import { Result, err, ok } from '../result';
import { escapeLike } from '../supabase/escape-like';
import { SUPABASE } from '../supabase/supabase.client';

interface MountRow {
  id: number;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  descripcion: string | null;
  precio: number | null;
  sucursal: string | null;
  codigo_barras: string | null;
  existencias: number | null;
}

const COLUMNS = 'id, marca, modelo, color, descripcion, precio, sucursal, codigo_barras, existencias';

function toMount(row: MountRow): Mount {
  return {
    id: row.id,
    brand: row.marca ?? '',
    model: row.modelo ?? '',
    color: row.color ?? '',
    description: row.descripcion ?? '',
    price: Number(row.precio ?? 0),
    branch: row.sucursal ?? '',
    barcode: row.codigo_barras ?? '',
    stock: row.existencias ?? 0,
  };
}

function toColumns(mount: NewMount) {
  return {
    marca: mount.brand,
    modelo: mount.model,
    color: mount.color,
    descripcion: mount.description,
    precio: mount.price,
    sucursal: mount.branch || null,
    codigo_barras: mount.barcode,
    existencias: mount.stock,
  };
}

@Injectable()
export class SupabaseMountRepository extends MountRepository {
  private readonly supabase = inject(SUPABASE);

  async search({ query, branch, page, pageSize }: MountSearch): Promise<Result<Page<Mount>, AppError>> {
    const text = query.trim();
    const from = (page - 1) * pageSize;

    let request = this.supabase.from('armazones').select(COLUMNS, { count: 'exact' }).gt('existencias', 0);
    if (text) {
      const escaped = escapeLike(text);
      request = request.or(`marca.ilike.%${escaped}%,modelo.ilike.%${escaped}%`);
    }
    if (branch) request = request.eq('sucursal', branch);

    const { data, count, error } = await request
      .order('marca')
      .range(from, from + pageSize - 1)
      .overrideTypes<MountRow[], { merge: false }>();
    if (error) return err(toAppError(error));
    return ok({ items: data.map(toMount), total: count ?? 0 });
  }

  async listInventory({ query, branch, stockStatus, page, pageSize }: MountInventorySearch): Promise<Result<Page<Mount>, AppError>> {
    const text = query.trim();
    const from = (page - 1) * pageSize;

    let request = this.supabase.from('armazones').select(COLUMNS, { count: 'exact' });
    if (text) {
      const escaped = escapeLike(text);
      request = request.or(`marca.ilike.%${escaped}%,modelo.ilike.%${escaped}%`);
    }
    if (branch) request = request.eq('sucursal', branch);
    if (stockStatus === 'low') request = request.gte('existencias', 1).lte('existencias', 2);
    if (stockStatus === 'out') request = request.eq('existencias', 0);

    const { data, count, error } = await request
      .order('existencias', { ascending: true })
      .order('marca')
      .range(from, from + pageSize - 1)
      .overrideTypes<MountRow[], { merge: false }>();
    if (error) return err(toAppError(error));
    return ok({ items: data.map(toMount), total: count ?? 0 });
  }

  async countByStock({ query, branch }: Pick<MountInventorySearch, 'query' | 'branch'>): Promise<Result<MountStockCounts, AppError>> {
    const text = query.trim();
    const base = () => {
      let request = this.supabase.from('armazones').select('id', { count: 'exact', head: true });
      if (text) {
        const escaped = escapeLike(text);
        request = request.or(`marca.ilike.%${escaped}%,modelo.ilike.%${escaped}%`);
      }
      if (branch) request = request.eq('sucursal', branch);
      return request;
    };

    const [all, low, out] = await Promise.all([base(), base().gte('existencias', 1).lte('existencias', 2), base().eq('existencias', 0)]);
    if (all.error) return err(toAppError(all.error));
    if (low.error) return err(toAppError(low.error));
    if (out.error) return err(toAppError(out.error));
    return ok({ all: all.count ?? 0, low: low.count ?? 0, out: out.count ?? 0 });
  }

  async insert(mount: NewMount): Promise<Result<Mount, AppError>> {
    const { data, error } = await this.supabase.from('armazones').insert(toColumns(mount)).select(COLUMNS).single<MountRow>();
    if (error) return err(toAppError(error));
    return ok(toMount(data));
  }

  async update(mount: Mount): Promise<Result<void, AppError>> {
    const { data, error } = await this.supabase.from('armazones').update(toColumns(mount)).eq('id', mount.id).select('id');
    if (error) return err(toAppError(error));
    if (data.length === 0) return err(appError('notFound', 'El armazón ya no existe o no tienes permiso para editarlo.'));
    return ok(undefined);
  }

  async delete(id: number): Promise<Result<void, AppError>> {
    const { data, error } = await this.supabase.from('armazones').delete().eq('id', id).select('id');
    if (error) return err(toAppError(error));
    if (data.length === 0) return err(appError('notFound', 'El armazón ya no existe o no tienes permiso para eliminarlo.'));
    return ok(undefined);
  }

  async decrementStock(id: number, quantity: number): Promise<Result<void, AppError>> {
    const { data, error: readError } = await this.supabase
      .from('armazones')
      .select('existencias')
      .eq('id', id)
      .single<{ existencias: number | null }>();
    if (readError) return err(toAppError(readError));

    const next = Math.max((data.existencias ?? 0) - quantity, 0);
    const { error } = await this.supabase.from('armazones').update({ existencias: next }).eq('id', id);
    if (error) return err(toAppError(error));
    return ok(undefined);
  }
}
