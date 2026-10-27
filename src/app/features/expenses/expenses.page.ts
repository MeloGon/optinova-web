import { Dialog } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  LucideDynamicIcon,
  LucidePlus,
  LucideReceipt,
  LucideRefreshCw,
  LucideSearch,
  LucideSlidersHorizontal,
  LucideSquarePen,
  LucideTag,
  LucideTrash2,
  LucideTriangleAlert,
  LucideWallet,
  LucideX,
} from '@lucide/angular';
import { SessionStore } from '../../core/auth/session.store';
import { ConfigService } from '../../core/config/config.service';
import { Expense } from '../../core/models/expense';
import { ExpenseSearch } from '../../core/repositories/expense.repository';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { ConfirmService } from '../../shared/ui/dialog/confirm.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { Paginator } from '../../shared/ui/paginator/paginator';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { OnvTable, TableCard } from '../../shared/ui/table/table';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { CategoryDialog, CategoryDialogData, CATEGORY_DIALOG_TITLE_ID } from './components/category-dialog';
import { ExpenseFormDialog, ExpenseFormDialogData, EXPENSE_FORM_TITLE_ID } from './components/expense-form-dialog';
import { ExpensesStore } from './expenses.store';

const PAGE_SIZES = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

function toPage(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

function toPageSize(value: string | undefined): number {
  const n = Number(value);
  return PAGE_SIZES.includes(n) ? n : DEFAULT_PAGE_SIZE;
}

/** "efectivo" → "Efectivo". */
function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/**
 * Egresos (= ExpensesView de Flutter). La URL guarda el filtro (?q=&branch=&page=&size=), igual
 * que Buscar paciente.
 */
@Component({
  selector: 'app-expenses-page',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    MoneyPipe,
    LucideDynamicIcon,
    EmptyState,
    Paginator,
    Skeleton,
    OnvTable,
    TableCard,
  ],
  providers: [ExpensesStore],
  templateUrl: './expenses.page.html',
})
export class ExpensesPage {
  readonly q = input<string>();
  readonly branch = input<string>();
  readonly page = input<string>();
  readonly size = input<string>();

  protected readonly store = inject(ExpensesStore);
  private readonly session = inject(SessionStore);
  private readonly config = inject(ConfigService).config;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(Dialog);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly branches = computed(() => this.config().branches);

  protected readonly search = computed<ExpenseSearch>(() => ({
    query: (this.q() ?? '').trim(),
    branch: this.branch() || null,
    page: toPage(this.page()),
    pageSize: toPageSize(this.size()),
  }));

  /** Lo que el usuario está escribiendo; no busca hasta Enter o "Buscar". */
  protected readonly text = new FormControl('', { nonNullable: true });

  protected readonly skeletonRows = Array.from({ length: 6 }, (_, i) => i);
  protected readonly capitalize = capitalize;

  protected readonly icons = {
    wallet: LucideWallet,
    receipt: LucideReceipt,
    tag: LucideTag,
    plus: LucidePlus,
    categories: LucideSlidersHorizontal,
    search: LucideSearch,
    clear: LucideX,
    edit: LucideSquarePen,
    trash: LucideTrash2,
    alert: LucideTriangleAlert,
    retry: LucideRefreshCw,
  };

  protected readonly loadingDelete = signal<string | null>(null);

  constructor() {
    void this.store.loadCategories();

    effect(() => {
      const search = this.search();
      untracked(() => void this.store.load(search));
    });

    effect(() => {
      const query = this.search().query;
      untracked(() => this.text.setValue(query));
    });

    effect(() => {
      const { page, pageSize } = this.search();
      const lastPage = Math.ceil(this.store.total() / pageSize);
      const outOfRange =
        this.store.loaded() && !this.store.loading() && this.store.total() > 0 && page > lastPage;
      if (outOfRange) untracked(() => void this.navigate({ page: lastPage === 1 ? null : lastPage }));
    });
  }

  protected submit(): void {
    const query = this.text.value.trim();
    const current = this.search();
    if (query === current.query && current.page === 1) {
      void this.store.load(current);
      return;
    }
    void this.navigate({ q: query || null, page: null });
  }

  protected clear(): void {
    this.text.setValue('');
    this.submit();
  }

  protected setBranch(value: string): void {
    void this.navigate({ branch: value || null, page: null });
  }

  protected clearFilters(): void {
    this.text.setValue('');
    void this.navigate({ q: null, branch: null, page: null });
  }

  protected goToPage(page: number): void {
    void this.navigate({ page: page === 1 ? null : page });
  }

  protected changePageSize(size: number): void {
    void this.navigate({ size: size === DEFAULT_PAGE_SIZE ? null : size, page: null });
  }

  protected retry(): void {
    void this.store.load(this.search());
  }

  protected openNew(): void {
    const data: ExpenseFormDialogData = {
      expense: null,
      categories: this.store.categories(),
      save: (draft) => this.store.create(draft, this.session.profile()?.name ?? ''),
    };
    const ref = this.dialog.open<boolean>(ExpenseFormDialog, {
      data,
      role: 'dialog',
      ariaLabelledBy: EXPENSE_FORM_TITLE_ID,
      disableClose: true,
      backdropClass: ['bg-overlay'],
    });
    ref.closed.subscribe((saved) => {
      if (saved) this.toast.show({ tone: 'success', title: 'Egreso registrado' });
    });
  }

  protected openEdit(expense: Expense): void {
    const data: ExpenseFormDialogData = {
      expense,
      categories: this.store.categories(),
      save: (draft) => this.store.update({ ...expense, ...draft }),
    };
    const ref = this.dialog.open<boolean>(ExpenseFormDialog, {
      data,
      role: 'dialog',
      ariaLabelledBy: EXPENSE_FORM_TITLE_ID,
      disableClose: true,
      backdropClass: ['bg-overlay'],
    });
    ref.closed.subscribe((saved) => {
      if (saved) this.toast.show({ tone: 'success', title: 'Egreso actualizado' });
    });
  }

  protected openCategories(): void {
    const data: CategoryDialogData = {
      categories: this.store.categories,
      create: (category) => this.store.createCategory(category),
      remove: (id) => this.store.deleteCategory(id),
    };
    this.dialog.open<void>(CategoryDialog, {
      data,
      role: 'dialog',
      ariaLabelledBy: CATEGORY_DIALOG_TITLE_ID,
      backdropClass: ['bg-overlay'],
    });
  }

  protected async askDelete(expense: Expense): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: '¿Eliminar este egreso?',
      text: `"${expense.description}" no se puede deshacer.`,
      confirmLabel: 'Eliminar egreso',
    });
    if (!confirmed) return;

    this.loadingDelete.set(expense.id);
    const result = await this.store.remove(expense.id);
    this.loadingDelete.set(null);

    if (result.ok) {
      this.toast.show({ tone: 'success', title: 'Egreso eliminado' });
    } else {
      this.toast.show({ tone: 'danger', title: 'No se pudo eliminar', text: result.error.message });
    }
  }

  private navigate(queryParams: Params): Promise<boolean> {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
