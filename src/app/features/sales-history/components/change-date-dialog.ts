import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideDynamicIcon, LucideTriangleAlert } from '@lucide/angular';
import { AppError } from '../../../core/errors/app-error';
import { Result } from '../../../core/result';
import { DatePicker } from '../../../shared/ui/date-picker/date-picker';

export interface ChangeDateDialogData {
  folio: string;
  currentDate: string;
  save: (newDate: string) => Promise<Result<unknown, AppError>>;
}

export const CHANGE_DATE_TITLE_ID = 'change-date-title';

/** = `updateSaleDate` de Flutter, un solo campo: la fecha nueva de la venta. */
@Component({
  selector: 'app-change-date-dialog',
  imports: [ReactiveFormsModule, LucideDynamicIcon, DatePicker],
  templateUrl: './change-date-dialog.html',
  host: {
    class: 'block w-[380px] max-w-[calc(100vw-2rem)] rounded-xl bg-card text-card-foreground elev-xl',
    '(keydown.escape)': 'cancel()',
  },
})
export class ChangeDateDialog {
  private readonly data = inject<ChangeDateDialogData>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<boolean>>(DialogRef);

  protected readonly titleId = CHANGE_DATE_TITLE_ID;
  protected readonly alertIcon = LucideTriangleAlert;
  protected readonly folio = this.data.folio;

  protected readonly dateControl = new FormControl(this.data.currentDate, { nonNullable: true, validators: [Validators.required] });

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    this.dateControl.markAsTouched();
    if (this.dateControl.invalid || this.saving()) return;

    this.saving.set(true);
    this.error.set(null);
    const result = await this.data.save(this.dateControl.value);
    this.saving.set(false);

    if (result.ok) this.ref.close(true);
    else this.error.set(result.error.message);
  }

  protected cancel(): void {
    if (!this.saving()) this.ref.close(false);
  }
}
