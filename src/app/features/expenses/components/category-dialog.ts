import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideDynamicIcon, LucideTrash2 } from '@lucide/angular';
import { AppError } from '../../../core/errors/app-error';
import { ExpenseCategory } from '../../../core/models/expense-category';
import { NewExpenseCategory } from '../../../core/repositories/expense.repository';
import { Result } from '../../../core/result';
import { ConfirmService } from '../../../shared/ui/dialog/confirm.service';
import { Field } from '../../../shared/ui/field/field';
import { OnvInput } from '../../../shared/ui/field/input';
import { ToastService } from '../../../shared/ui/toast/toast.service';

export interface CategoryDialogData {
  categories: () => ExpenseCategory[];
  create: (category: NewExpenseCategory) => Promise<Result<ExpenseCategory, AppError>>;
  remove: (id: number) => Promise<Result<void, AppError>>;
}

export const CATEGORY_DIALOG_TITLE_ID = 'category-dialog-title';

/** Mismos diez colores que el preset de Flutter. */
export const PRESET_COLORS = [
  '#6366F1',
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#0EA5E9',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
  '#D97706',
];

/** Gestionar categorías (C-12). = ExpenseCategoryDialog de Flutter. */
@Component({
  selector: 'app-category-dialog',
  imports: [ReactiveFormsModule, LucideDynamicIcon, Field, OnvInput],
  templateUrl: './category-dialog.html',
  host: {
    class: 'block w-[420px] max-w-[calc(100vw-2rem)] rounded-xl bg-card text-card-foreground elev-xl',
    '(keydown.escape)': 'close()',
  },
})
export class CategoryDialog {
  private readonly data = inject<CategoryDialogData>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<void>>(DialogRef);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly titleId = CATEGORY_DIALOG_TITLE_ID;
  protected readonly trashIcon = LucideTrash2;
  protected readonly presetColors = PRESET_COLORS;
  protected readonly categories = this.data.categories;

  protected readonly showForm = signal(false);
  protected readonly saving = signal(false);
  protected readonly selectedColor = signal(PRESET_COLORS[0]);

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected openForm(): void {
    this.showForm.set(true);
  }

  protected cancelForm(): void {
    this.showForm.set(false);
    this.form.reset({ name: '' });
    this.selectedColor.set(PRESET_COLORS[0]);
  }

  protected pickColor(color: string): void {
    this.selectedColor.set(color);
  }

  protected async addCategory(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    const result = await this.data.create({ name: this.form.getRawValue().name.trim(), color: this.selectedColor() });
    this.saving.set(false);

    if (result.ok) {
      this.cancelForm();
    } else {
      this.toast.show({ tone: 'danger', title: 'No se pudo agregar la categoría', text: result.error.message });
    }
  }

  protected async deleteCategory(category: ExpenseCategory): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: `¿Eliminar "${category.name}"?`,
      text: 'Si hay egresos con esta categoría, no se podrá eliminar.',
      confirmLabel: 'Eliminar categoría',
    });
    if (!confirmed) return;

    const result = await this.data.remove(category.id);
    if (result.ok) {
      this.toast.show({ tone: 'success', title: 'Categoría eliminada', text: category.name });
    } else {
      this.toast.show({ tone: 'danger', title: 'No se pudo eliminar', text: result.error.message });
    }
  }

  protected close(): void {
    this.ref.close();
  }
}
