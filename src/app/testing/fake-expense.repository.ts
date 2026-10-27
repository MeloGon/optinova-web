import { AppError } from '../core/errors/app-error';
import { Expense } from '../core/models/expense';
import { ExpenseCategory } from '../core/models/expense-category';
import { Page } from '../core/models/page';
import {
  ExpenseRepository,
  ExpenseSearch,
  NewExpense,
  NewExpenseCategory,
} from '../core/repositories/expense.repository';
import { Result, err, ok } from '../core/result';

export const fakeExpense = (id: number | string, description = `EGRESO ${id}`): Expense => ({
  id: String(id),
  date: '2026-10-01',
  categoryId: null,
  categoryName: null,
  categoryColor: null,
  description,
  amount: 100,
  paymentMethod: 'efectivo',
  receipt: '',
  branch: 'OFTALVISION',
  registeredBy: 'Vendedor Prueba',
  notes: '',
});

export const fakeCategory = (id: number, name = `CATEGORIA ${id}`): ExpenseCategory => ({
  id,
  name,
  color: '#6366F1',
});

/** ExpenseRepository en memoria para tests. */
export class FakeExpenseRepository extends ExpenseRepository {
  expenses: Expense[] = [];
  categories: ExpenseCategory[] = [];

  calls: ExpenseSearch[] = [];
  failWith: AppError | null = null;
  gate: (() => Promise<void>) | null = null;

  created: { expense: NewExpense; registeredBy: string }[] = [];
  createFailWith: AppError | null = null;
  private nextId = 1000;

  updated: Expense[] = [];
  updateFailWith: AppError | null = null;

  deleted: string[] = [];
  deleteFailWith: AppError | null = null;

  createdCategories: NewExpenseCategory[] = [];
  createCategoryFailWith: AppError | null = null;
  private nextCategoryId = 1000;

  deletedCategories: number[] = [];
  deleteCategoryFailWith: AppError | null = null;

  async search(params: ExpenseSearch): Promise<Result<Page<Expense>, AppError>> {
    this.calls.push(params);
    if (this.gate) await this.gate();
    if (this.failWith) return err(this.failWith);

    const query = params.query.toLowerCase();
    const matches = this.expenses.filter(
      (e) =>
        (!query || e.description.toLowerCase().includes(query) || e.receipt.toLowerCase().includes(query)) &&
        (!params.branch || e.branch === params.branch),
    );
    const from = (params.page - 1) * params.pageSize;
    return ok({ items: matches.slice(from, from + params.pageSize), total: matches.length });
  }

  async create(expense: NewExpense, registeredBy: string): Promise<Result<Expense, AppError>> {
    if (this.createFailWith) return err(this.createFailWith);
    this.created.push({ expense, registeredBy });
    const category = this.categories.find((c) => c.id === expense.categoryId) ?? null;
    const saved: Expense = {
      ...expense,
      id: String(this.nextId++),
      categoryName: category?.name ?? null,
      categoryColor: category?.color ?? null,
      registeredBy,
    };
    this.expenses = [saved, ...this.expenses];
    return ok(saved);
  }

  async update(expense: Expense): Promise<Result<void, AppError>> {
    if (this.updateFailWith) return err(this.updateFailWith);
    this.updated.push(expense);
    this.expenses = this.expenses.map((e) => (e.id === expense.id ? expense : e));
    return ok(undefined);
  }

  async delete(id: string): Promise<Result<void, AppError>> {
    if (this.deleteFailWith) return err(this.deleteFailWith);
    this.deleted.push(id);
    this.expenses = this.expenses.filter((e) => e.id !== id);
    return ok(undefined);
  }

  async listCategories(): Promise<Result<ExpenseCategory[], AppError>> {
    return ok(this.categories);
  }

  async createCategory(category: NewExpenseCategory): Promise<Result<ExpenseCategory, AppError>> {
    if (this.createCategoryFailWith) return err(this.createCategoryFailWith);
    this.createdCategories.push(category);
    const saved: ExpenseCategory = { ...category, id: this.nextCategoryId++ };
    this.categories = [...this.categories, saved];
    return ok(saved);
  }

  async deleteCategory(id: number): Promise<Result<void, AppError>> {
    if (this.deleteCategoryFailWith) return err(this.deleteCategoryFailWith);
    this.deletedCategories.push(id);
    this.categories = this.categories.filter((c) => c.id !== id);
    return ok(undefined);
  }
}
