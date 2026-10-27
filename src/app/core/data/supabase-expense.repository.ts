import { Injectable, inject } from '@angular/core';
import { AppError, appError, toAppError } from '../errors/app-error';
import { Expense } from '../models/expense';
import { ExpenseCategory } from '../models/expense-category';
import { Page } from '../models/page';
import {
  ExpenseRepository,
  ExpenseSearch,
  NewExpense,
  NewExpenseCategory,
} from '../repositories/expense.repository';
import { Result, err, ok } from '../result';
import { SUPABASE } from '../supabase/supabase.client';

/** Fila de `egresos` con su categoría unida, tal como viene de la DB. */
interface ExpenseRow {
  id: string;
  fecha: string;
  categoria_id: number | null;
  descripcion: string;
  monto: number;
  metodo_pago: string;
  comprobante: string | null;
  sucursal: string | null;
  registrado_por: string | null;
  notas: string | null;
  categorias_egresos: { nombre: string; color: string } | null;
}

interface CategoryRow {
  id: number;
  nombre: string;
  color: string;
}

const COLUMNS =
  'id, fecha, categoria_id, descripcion, monto, metodo_pago, comprobante, sucursal, registrado_por, notas, categorias_egresos(nombre, color)';

function toColumns(expense: NewExpense) {
  return {
    fecha: expense.date,
    categoria_id: expense.categoryId,
    descripcion: expense.description,
    monto: expense.amount,
    metodo_pago: expense.paymentMethod,
    comprobante: expense.receipt || null,
    sucursal: expense.branch || null,
    notas: expense.notes || null,
  };
}

function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    date: row.fecha,
    categoryId: row.categoria_id,
    categoryName: row.categorias_egresos?.nombre ?? null,
    categoryColor: row.categorias_egresos?.color ?? null,
    description: row.descripcion,
    amount: Number(row.monto),
    paymentMethod: row.metodo_pago,
    receipt: row.comprobante ?? '',
    branch: row.sucursal ?? '',
    registeredBy: row.registrado_por ?? '',
    notes: row.notas ?? '',
  };
}

function toCategory(row: CategoryRow): ExpenseCategory {
  return { id: row.id, name: row.nombre, color: row.color };
}

/**
 * `%` y `_` son comodines de `ilike`: se escriben literales (= escapeLike de patient.repository).
 */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, '\\\\$&');
}

@Injectable()
export class SupabaseExpenseRepository extends ExpenseRepository {
  private readonly supabase = inject(SUPABASE);

  async search({ query, branch, page, pageSize }: ExpenseSearch): Promise<Result<Page<Expense>, AppError>> {
    const from = (page - 1) * pageSize;

    let request = this.supabase.from('egresos').select(COLUMNS, { count: 'exact' });
    const words = query.trim();
    if (words) {
      const escaped = escapeLike(words);
      request = request.or(`descripcion.ilike.%${escaped}%,comprobante.ilike.%${escaped}%`);
    }
    if (branch) request = request.eq('sucursal', branch);

    const { data, count, error } = await request
      .order('fecha', { ascending: false })
      // Desempate estable: sin él, dos egresos del mismo día podrían saltar entre páginas.
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)
      .overrideTypes<ExpenseRow[], { merge: false }>();

    if (error) return err(toAppError(error));
    return ok({ items: data.map(toExpense), total: count ?? 0 });
  }

  async create(expense: NewExpense, registeredBy: string): Promise<Result<Expense, AppError>> {
    const { data, error } = await this.supabase
      .from('egresos')
      .insert({ ...toColumns(expense), registrado_por: registeredBy })
      .select(COLUMNS)
      .single<ExpenseRow>();

    if (error) return err(toAppError(error));
    return ok(toExpense(data));
  }

  async update(expense: Expense): Promise<Result<void, AppError>> {
    const { data, error } = await this.supabase
      .from('egresos')
      .update(toColumns(expense))
      .eq('id', expense.id)
      .select('id');

    if (error) return err(toAppError(error));
    if (data.length === 0) {
      return err(appError('notFound', 'El egreso ya no existe o no tienes permiso para editarlo.'));
    }
    return ok(undefined);
  }

  async delete(id: string): Promise<Result<void, AppError>> {
    const { data, error } = await this.supabase.from('egresos').delete().eq('id', id).select('id');

    if (error) return err(toAppError(error));
    if (data.length === 0) {
      return err(appError('notFound', 'El egreso ya no existe o no tienes permiso para eliminarlo.'));
    }
    return ok(undefined);
  }

  async listCategories(): Promise<Result<ExpenseCategory[], AppError>> {
    const { data, error } = await this.supabase
      .from('categorias_egresos')
      .select('id, nombre, color')
      .order('nombre', { ascending: true })
      .overrideTypes<CategoryRow[], { merge: false }>();

    if (error) return err(toAppError(error));
    return ok(data.map(toCategory));
  }

  async createCategory(category: NewExpenseCategory): Promise<Result<ExpenseCategory, AppError>> {
    const { data, error } = await this.supabase
      .from('categorias_egresos')
      .insert({ nombre: category.name, color: category.color })
      .select('id, nombre, color')
      .single<CategoryRow>();

    if (error) {
      // categorias_egresos_nombre_key: nombre repetido.
      if (error.code === '23505') {
        return err(appError('server', 'Ya existe una categoría con ese nombre.'));
      }
      return err(toAppError(error));
    }
    return ok(toCategory(data));
  }

  async deleteCategory(id: number): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.from('categorias_egresos').delete().eq('id', id);

    if (error) {
      // egresos_categoria_id_fkey sin ON DELETE SET NULL: bloquea el borrado si está en uso.
      if (error.code === '23503') {
        return err(appError('server', 'No se puede eliminar: hay egresos registrados con esta categoría.'));
      }
      return err(toAppError(error));
    }
    return ok(undefined);
  }
}
