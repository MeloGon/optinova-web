import { Injectable, inject } from '@angular/core';
import { AppError, toAppError } from '../errors/app-error';
import { Page } from '../models/page';
import { Resin } from '../models/resin';
import { ResinRepository, ResinSearch } from '../repositories/resin.repository';
import { Result, err, ok } from '../result';
import { SUPABASE } from '../supabase/supabase.client';

interface ResinRow {
  id_oftalmico: number;
  descripcion: string | null;
  diseno: string | null;
  linea: string | null;
  material: string | null;
  tecnologia: string | null;
  texto: string | null;
  cantidad: number | null;
  precio: number | null;
  precio_interno: number | null;
}

const COLUMNS = 'id_oftalmico, descripcion, diseno, linea, material, tecnologia, texto, cantidad, precio, precio_interno';

function toResin(row: ResinRow): Resin {
  return {
    id: row.id_oftalmico,
    description: row.descripcion ?? '',
    design: row.diseno ?? '',
    line: row.linea ?? '',
    material: row.material ?? '',
    technology: row.tecnologia ?? '',
    text: row.texto ?? '',
    quantity: row.cantidad ?? 0,
    price: Number(row.precio ?? 0),
    priceInternal: Number(row.precio_interno ?? 0),
  };
}

/** `%` y `_` son comodines de `ilike`: se escriben literales. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, '\\\\$&');
}

@Injectable()
export class SupabaseResinRepository extends ResinRepository {
  private readonly supabase = inject(SUPABASE);

  async search({ query, page, pageSize }: ResinSearch): Promise<Result<Page<Resin>, AppError>> {
    const text = query.trim();
    const from = (page - 1) * pageSize;

    let request = this.supabase.from('resinas').select(COLUMNS, { count: 'exact' });
    if (text) {
      const escaped = escapeLike(text);
      request = request.or(`descripcion.ilike.%${escaped}%,texto.ilike.%${escaped}%`);
    }

    const { data, count, error } = await request
      .order('descripcion')
      .range(from, from + pageSize - 1)
      .overrideTypes<ResinRow[], { merge: false }>();
    if (error) return err(toAppError(error));
    return ok({ items: data.map(toResin), total: count ?? 0 });
  }
}
