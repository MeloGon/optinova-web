import { Injectable, inject } from '@angular/core';
import { AppError, toAppError } from '../errors/app-error';
import { Mount } from '../models/mount';
import { Page } from '../models/page';
import { MountRepository, MountSearch } from '../repositories/mount.repository';
import { Result, err, ok } from '../result';
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

/** `%` y `_` son comodines de `ilike`: se escriben literales. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, '\\\\$&');
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
