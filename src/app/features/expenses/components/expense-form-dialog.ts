import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideDynamicIcon, LucideTriangleAlert } from '@lucide/angular';
import { AppError } from '../../../core/errors/app-error';
import { Expense } from '../../../core/models/expense';
import { ExpenseCategory } from '../../../core/models/expense-category';
import { ConfigService } from '../../../core/config/config.service';
import { NewExpense } from '../../../core/repositories/expense.repository';
import { Result } from '../../../core/result';
import { DatePicker } from '../../../shared/ui/date-picker/date-picker';
import { Field } from '../../../shared/ui/field/field';
import { OnvInput } from '../../../shared/ui/field/input';

export interface ExpenseFormDialogData {
  /** null = nuevo egreso. */
  expense: Expense | null;
  categories: ExpenseCategory[];
  save: (draft: NewExpense) => Promise<Result<unknown, AppError>>;
}

export const EXPENSE_FORM_TITLE_ID = 'expense-form-title';

/** Hoy como `yyyy-MM-dd`, igual que en los diálogos de paciente y medidas. */
function today(): string {
  return new Date().toLocaleDateString('en-CA');
}

/**
 * Nuevo / editar egreso (C-12 con formulario). = ExpenseFormDialog de Flutter (un solo diálogo para
 * ambos casos, según si llega `expense`).
 */
@Component({
  selector: 'app-expense-form-dialog',
  imports: [ReactiveFormsModule, LucideDynamicIcon, DatePicker, Field, OnvInput],
  templateUrl: './expense-form-dialog.html',
  host: {
    class: 'block w-[560px] max-w-[calc(100vw-2rem)] rounded-xl bg-card text-card-foreground elev-xl',
    '(keydown.escape)': 'cancel()',
  },
})
export class ExpenseFormDialog {
  private readonly data = inject<ExpenseFormDialogData>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly config = inject(ConfigService).config;

  protected readonly titleId = EXPENSE_FORM_TITLE_ID;
  protected readonly alertIcon = LucideTriangleAlert;
  protected readonly isEditing = this.data.expense !== null;
  protected readonly categories = this.data.categories;
  protected readonly branches = this.config().branches;
  protected readonly paymentMethods = this.config().paymentMethods;

  protected readonly form = new FormGroup({
    date: new FormControl(this.data.expense?.date ?? today(), { nonNullable: true, validators: [Validators.required] }),
    categoryId: new FormControl<number | null>(this.data.expense?.categoryId ?? null),
    description: new FormControl(this.data.expense?.description ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    amount: new FormControl<number | null>(this.data.expense?.amount ?? null, [
      Validators.required,
      Validators.min(0.01),
    ]),
    paymentMethod: new FormControl(this.data.expense?.paymentMethod ?? this.paymentMethods[0]?.value ?? 'efectivo', {
      nonNullable: true,
    }),
    receipt: new FormControl(this.data.expense?.receipt ?? '', { nonNullable: true }),
    branch: new FormControl(this.data.expense?.branch ?? '', { nonNullable: true }),
    notes: new FormControl(this.data.expense?.notes ?? '', { nonNullable: true }),
  });

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    const value = this.form.getRawValue();
    const draft: NewExpense = {
      date: value.date,
      categoryId: value.categoryId,
      description: value.description.trim(),
      amount: value.amount ?? 0,
      paymentMethod: value.paymentMethod,
      receipt: value.receipt.trim(),
      branch: value.branch,
      notes: value.notes.trim(),
    };

    this.saving.set(true);
    this.error.set(null);
    const result = await this.data.save(draft);
    this.saving.set(false);

    if (result.ok) this.ref.close(true);
    else this.error.set(result.error.message);
  }

  protected cancel(): void {
    if (!this.saving()) this.ref.close(false);
  }
}
