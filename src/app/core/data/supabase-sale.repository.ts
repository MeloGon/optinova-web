import { Injectable, inject } from '@angular/core';
import { AppError, toAppError } from '../errors/app-error';
import { Page } from '../models/page';
import { Sale } from '../models/sale';
import { SaleItem } from '../models/sale-item';
import { SaleRepository, SaleSearch, SaleStatusCounts } from '../repositories/sale.repository';
import { Result, err, ok } from '../result';
import { SUPABASE } from '../supabase/supabase.client';

/** Fila de `ventas` tal como viene de la DB. */
interface SaleRow {
  id: string;
  folio: string | null;
  sucursal: string | null;
  fecha_actualizada: string | null;
  paciente_nombre: string | null;
  autor_nombre: string | null;
  total: number | null;
  descuento: number | null;
  total_con_descuento: number | null;
  a_cuenta: number | null;
  resta: number | null;
}

interface SaleItemRow {
  id: number;
  descripcion: string | null;
  diseno: string | null;
  linea: string | null;
  material: string | null;
  tecnologia: string | null;
  serie: string | null;
  texto: string | null;
  cantidad: string | null;
  precio: number | null;
  montura: string | null;
  montura_marca: string | null;
  montura_modelo: string | null;
  montura_color: string | null;
  montura_cantidad: string | null;
  montura_precio: number | null;
  montura_texto: string | null;
}

const COLUMNS =
  'id, folio, sucursal, fecha_actualizada, paciente_nombre, autor_nombre, total, descuento, total_con_descuento, a_cuenta, resta';

const ITEM_COLUMNS =
  'id, descripcion, diseno, linea, material, tecnologia, serie, texto, cantidad, precio, montura, montura_marca, montura_modelo, montura_color, montura_cantidad, montura_precio, montura_texto';

function toSale(row: SaleRow): Sale {
  const total = Number(row.total ?? 0);
  const discount = Number(row.descuento ?? 0);
  const totalWithDiscount = Number(row.total_con_descuento ?? total);
  const account = Number(row.a_cuenta ?? 0);
  return {
    id: row.id,
    folio: row.folio ?? '',
    branch: row.sucursal ?? '',
    date: row.fecha_actualizada ?? '',
    patientName: row.paciente_nombre ?? '',
    sellerName: row.autor_nombre ?? '',
    total,
    discount,
    totalWithDiscount,
    account,
    rest: Number(row.resta ?? Math.max(totalWithDiscount - account, 0)),
  };
}

function toSaleItem(row: SaleItemRow): SaleItem {
  return {
    id: row.id,
    description: row.descripcion ?? '',
    design: row.diseno ?? '',
    line: row.linea ?? '',
    material: row.material ?? '',
    technology: row.tecnologia ?? '',
    serie: row.serie ?? '',
    text: row.texto ?? '',
    quantity: row.cantidad ?? '',
    price: Number(row.precio ?? 0),
    mount: row.montura ?? '',
    mountBrand: row.montura_marca ?? '',
    mountModel: row.montura_modelo ?? '',
    mountColor: row.montura_color ?? '',
    mountQuantity: row.montura_cantidad ?? '',
    mountPrice: Number(row.montura_precio ?? 0),
    mountText: row.montura_texto ?? '',
  };
}

/** `%` y `_` son comodines de `ilike`: se escriben literales. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, '\\\\$&');
}

@Injectable()
export class SupabaseSaleRepository extends SaleRepository {
  private readonly supabase = inject(SUPABASE);

  async search({ query, branch, date, status, page, pageSize }: SaleSearch): Promise<Result<Page<Sale>, AppError>> {
    const from = (page - 1) * pageSize;
    const text = query.trim();

    let request = this.supabase.from('ventas').select(COLUMNS, { count: 'exact' });
    if (text) {
      const escaped = escapeLike(text);
      request = request.or(`paciente_nombre.ilike.%${escaped}%,folio.ilike.%${escaped}%`);
    }
    if (branch) request = request.eq('sucursal', branch);
    if (date) request = request.eq('fecha_actualizada', date);
    if (status === 'balance') request = request.gt('resta', 0);
    if (status === 'paid') request = request.eq('resta', 0);

    const { data, count, error } = await request
      .order('fecha_actualizada', { ascending: false })
      // Desempate estable: sin él, dos ventas del mismo día podrían saltar entre páginas.
      .order('id', { ascending: false })
      .range(from, from + pageSize - 1)
      .overrideTypes<SaleRow[], { merge: false }>();

    if (error) return err(toAppError(error));
    return ok({ items: data.map(toSale), total: count ?? 0 });
  }

  async countByStatus({
    query,
    branch,
    date,
  }: Pick<SaleSearch, 'query' | 'branch' | 'date'>): Promise<Result<SaleStatusCounts, AppError>> {
    const text = query.trim();
    const base = () => {
      let request = this.supabase.from('ventas').select('id', { count: 'exact', head: true });
      if (text) {
        const escaped = escapeLike(text);
        request = request.or(`paciente_nombre.ilike.%${escaped}%,folio.ilike.%${escaped}%`);
      }
      if (branch) request = request.eq('sucursal', branch);
      if (date) request = request.eq('fecha_actualizada', date);
      return request;
    };

    const [all, balance, paid] = await Promise.all([base(), base().gt('resta', 0), base().eq('resta', 0)]);

    if (all.error) return err(toAppError(all.error));
    if (balance.error) return err(toAppError(balance.error));
    if (paid.error) return err(toAppError(paid.error));

    return ok({ all: all.count ?? 0, balance: balance.count ?? 0, paid: paid.count ?? 0 });
  }

  async getItems(folio: string): Promise<Result<SaleItem[], AppError>> {
    const { data, error } = await this.supabase
      .from('venta_items')
      .select(ITEM_COLUMNS)
      .eq('folio_venta', folio)
      .overrideTypes<SaleItemRow[], { merge: false }>();

    if (error) return err(toAppError(error));
    return ok(data.map(toSaleItem));
  }

  async applyPayment(
    saleId: string,
    newAccount: number,
    newRest: number,
    paymentDate: string,
  ): Promise<Result<void, AppError>> {
    const { error } = await this.supabase
      .from('ventas')
      .update({ a_cuenta: newAccount, resta: newRest, fecha_actualizada: paymentDate })
      .eq('id', saleId);

    if (error) return err(toAppError(error));
    return ok(undefined);
  }
}
