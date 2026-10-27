import { AppError } from '../errors/app-error';
import { Expense } from '../models/expense';
import { ExpenseCategory } from '../models/expense-category';
import { Page } from '../models/page';
import { Result } from '../result';

export interface ExpenseSearch {
  /** Busca en descripción y comprobante; vacío = todos. */
  query: string;
  /** Texto de sucursal; null = todas. */
  branch: string | null;
  /** Empieza en 1. */
  page: number;
  pageSize: number;
}

/** Lo que se escribe al crear un egreso: el ID, `registeredBy` y `categoryName/Color` los pone la DB o el store. */
export type NewExpense = Omit<Expense, 'id' | 'categoryName' | 'categoryColor' | 'registeredBy'>;

export type NewExpenseCategory = Omit<ExpenseCategory, 'id'>;

/** Contrato de egresos (= ExpenseRepository abstracto de Flutter). */
export abstract class ExpenseRepository {
  /** Egresos del más reciente al más antiguo. */
  abstract search(params: ExpenseSearch): Promise<Result<Page<Expense>, AppError>>;

  abstract create(expense: NewExpense, registeredBy: string): Promise<Result<Expense, AppError>>;

  /** Guarda los datos editables del egreso (todo salvo quién lo registró). */
  abstract update(expense: Expense): Promise<Result<void, AppError>>;

  abstract delete(id: string): Promise<Result<void, AppError>>;

  abstract listCategories(): Promise<Result<ExpenseCategory[], AppError>>;

  abstract createCategory(category: NewExpenseCategory): Promise<Result<ExpenseCategory, AppError>>;

  /**
   * Borra la categoría. La FK `egresos.categoria_id` no tiene `ON DELETE SET NULL` (igual que en prod),
   * así que si hay egresos con esa categoría la DB rechaza el borrado: llega como error, no en silencio.
   */
  abstract deleteCategory(id: number): Promise<Result<void, AppError>>;
}
