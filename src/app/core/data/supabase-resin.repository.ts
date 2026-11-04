import { Injectable, inject } from '@angular/core';
import { AppError, appError, toAppError } from '../errors/app-error';
import { Page } from '../models/page';
import { Resin } from '../models/resin';
import {
  NewResin,
  ResinInventorySearch,
  ResinRepository,
  ResinSearch,
  ResinStockCounts,
} from '../repositories/resin.repository';
import { Result, err, ok } from '../result';
import { escapeLike } from '../supabase/escape-like';
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

/** `text` es la misma concatenación que usaba Flutter para armar el nombre buscable. */
function toText(resin: Pick<NewResin, 'description' | 'design' | 'line' | 'material' | 'technology'>): string {
  return [resin.description, resin.design, resin.line, resin.material, resin.technology].filter(Boolean).join(' ');
}

function toColumns(resin: NewResin) {
  return {
    descripcion: resin.description,
    diseno: resin.design,
    linea: resin.line,
    material: resin.material,
    tecnologia: resin.technology,
    texto: toText(resin),
    cantidad: resin.quantity,
    precio: resin.price,
    precio_interno: resin.priceInternal,
  };
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

  async listInventory({ query, stockStatus, page, pageSize }: ResinInventorySearch): Promise<Result<Page<Resin>, AppError>> {
    const text = query.trim();
    const from = (page - 1) * pageSize;

    let request = this.supabase.from('resinas').select(COLUMNS, { count: 'exact' });
    if (text) {
      const escaped = escapeLike(text);
      request = request.or(`descripcion.ilike.%${escaped}%,texto.ilike.%${escaped}%`);
    }
    if (stockStatus === 'low') request = request.gte('cantidad', 1).lte('cantidad', 2);
    if (stockStatus === 'out') request = request.eq('cantidad', 0);

    const { data, count, error } = await request
      .order('cantidad', { ascending: true })
      .order('descripcion')
      .range(from, from + pageSize - 1)
      .overrideTypes<ResinRow[], { merge: false }>();
    if (error) return err(toAppError(error));
    return ok({ items: data.map(toResin), total: count ?? 0 });
  }

  async countByStock({ query }: Pick<ResinInventorySearch, 'query'>): Promise<Result<ResinStockCounts, AppError>> {
    const text = query.trim();
    const base = () => {
      let request = this.supabase.from('resinas').select('id_oftalmico', { count: 'exact', head: true });
      if (text) {
        const escaped = escapeLike(text);
        request = request.or(`descripcion.ilike.%${escaped}%,texto.ilike.%${escaped}%`);
      }
      return request;
    };

    const [all, low, out] = await Promise.all([base(), base().gte('cantidad', 1).lte('cantidad', 2), base().eq('cantidad', 0)]);
    if (all.error) return err(toAppError(all.error));
    if (low.error) return err(toAppError(low.error));
    if (out.error) return err(toAppError(out.error));
    return ok({ all: all.count ?? 0, low: low.count ?? 0, out: out.count ?? 0 });
  }

  async insert(resin: NewResin): Promise<Result<Resin, AppError>> {
    const { data, error } = await this.supabase.from('resinas').insert(toColumns(resin)).select(COLUMNS).single<ResinRow>();
    if (error) return err(toAppError(error));
    return ok(toResin(data));
  }

  async update(resin: Resin): Promise<Result<void, AppError>> {
    const { data, error } = await this.supabase
      .from('resinas')
      .update(toColumns(resin))
      .eq('id_oftalmico', resin.id)
      .select('id_oftalmico');
    if (error) return err(toAppError(error));
    if (data.length === 0) return err(appError('notFound', 'La resina ya no existe o no tienes permiso para editarla.'));
    return ok(undefined);
  }

  async delete(id: number): Promise<Result<void, AppError>> {
    const { data, error } = await this.supabase.from('resinas').delete().eq('id_oftalmico', id).select('id_oftalmico');
    if (error) return err(toAppError(error));
    if (data.length === 0) return err(appError('notFound', 'La resina ya no existe o no tienes permiso para eliminarla.'));
    return ok(undefined);
  }
}
