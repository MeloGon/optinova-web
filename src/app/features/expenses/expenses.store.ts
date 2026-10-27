import { Injectable, computed, inject, signal } from '@angular/core';
import { AppError } from '../../core/errors/app-error';
import { Expense } from '../../core/models/expense';
import { ExpenseCategory } from '../../core/models/expense-category';
import {
  ExpenseRepository,
  ExpenseSearch,
  NewExpense,
  NewExpenseCategory,
} from '../../core/repositories/expense.repository';
import { Result } from '../../core/result';

interface ExpensesState {
  items: Expense[];
  total: number;
  categories: ExpenseCategory[];
  loading: boolean;
  /** Mensaje para el usuario; null si no hay error. */
  error: string | null;
  /** Falso hasta que llega la primera respuesta: distingue "cargando" de "sin egresos". */
  loaded: boolean;
}

/**
 * Estado de Egresos (= Expenses Notifier de Flutter).
 * Se provee en la página (providers: [ExpensesStore]): nace y muere con ella (= autoDispose).
 */
@Injectable()
export class ExpensesStore {
  private readonly repo = inject(ExpenseRepository);

  private readonly state = signal<ExpensesState>({
    items: [],
    total: 0,
    categories: [],
    loading: false,
    error: null,
    loaded: false,
  });

  readonly items = computed(() => this.state().items);
  readonly total = computed(() => this.state().total);
  readonly categories = computed(() => this.state().categories);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly loaded = computed(() => this.state().loaded);

  /** Suma de los egresos de la página actual (igual que el resumen de Flutter: no es el total de todas las páginas). */
  readonly pageTotal = computed(() => this.state().items.reduce((sum, e) => sum + e.amount, 0));

  /** Número de la última búsqueda lanzada: una respuesta vieja no pisa a una más nueva. */
  private lastRequest = 0;

  /** Última búsqueda pedida: se repite después de crear/editar/eliminar para que la lista quede al día. */
  private lastSearch: ExpenseSearch | null = null;

  async load(search: ExpenseSearch): Promise<void> {
    this.lastSearch = search;
    const request = ++this.lastRequest;
    this.state.update((s) => ({ ...s, loading: true, error: null }));

    const result = await this.repo.search(search);
    if (request !== this.lastRequest) return;

    if (result.ok) {
      this.state.update((s) => ({
        ...s,
        items: result.value.items,
        total: result.value.total,
        loading: false,
        loaded: true,
      }));
    } else {
      this.state.update((s) => ({ ...s, loading: false, error: result.error.message, loaded: true }));
    }
  }

  async loadCategories(): Promise<void> {
    const result = await this.repo.listCategories();
    if (result.ok) this.state.update((s) => ({ ...s, categories: result.value }));
  }

  /** Crea el egreso y, si salió bien, vuelve a pedir la lista y las categorías. El error lo muestra quien llama. */
  async create(expense: NewExpense, registeredBy: string): Promise<Result<Expense, AppError>> {
    const result = await this.repo.create(expense, registeredBy);
    if (result.ok && this.lastSearch) await this.load(this.lastSearch);
    return result;
  }

  async update(expense: Expense): Promise<Result<void, AppError>> {
    return this.refreshAfter(await this.repo.update(expense));
  }

  async remove(id: string): Promise<Result<void, AppError>> {
    return this.refreshAfter(await this.repo.delete(id));
  }

  async createCategory(category: NewExpenseCategory): Promise<Result<ExpenseCategory, AppError>> {
    const result = await this.repo.createCategory(category);
    if (result.ok) await this.loadCategories();
    return result;
  }

  async deleteCategory(id: number): Promise<Result<void, AppError>> {
    const result = await this.repo.deleteCategory(id);
    if (result.ok) await this.loadCategories();
    return result;
  }

  private async refreshAfter(result: Result<void, AppError>): Promise<Result<void, AppError>> {
    if (result.ok && this.lastSearch) await this.load(this.lastSearch);
    return result;
  }
}
