import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { LucideDynamicIcon, LucideTriangleAlert } from '@lucide/angular';
import { AppError } from '../../../core/errors/app-error';
import { Review } from '../../../core/models/review';
import { Result } from '../../../core/result';
import { createMeasureForm, measureValues } from './measure-form';
import { MeasureFields } from './measure-fields';

export interface EditReviewDialogData {
  review: Review;
  save: (review: Review) => Promise<Result<void, AppError>>;
}

export const EDIT_REVIEW_TITLE_ID = 'edit-review-title';

/**
 * Editar medida (C-12 con formulario). = EditReviewDialog de Flutter.
 * La fecha y el paciente no se tocan aquí (igual que en Flutter: updateReview no los cambia).
 */
@Component({
  selector: 'app-edit-review-dialog',
  imports: [ReactiveFormsModule, DatePipe, LucideDynamicIcon, MeasureFields],
  templateUrl: './edit-review-dialog.html',
  host: {
    class: 'block w-[640px] max-w-[calc(100vw-2rem)] rounded-xl bg-card text-card-foreground elev-xl',
    '(keydown.escape)': 'cancel()',
  },
})
export class EditReviewDialog {
  private readonly data = inject<EditReviewDialogData>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<boolean>>(DialogRef);

  protected readonly review = this.data.review;
  protected readonly titleId = EDIT_REVIEW_TITLE_ID;
  protected readonly alertIcon = LucideTriangleAlert;
  protected readonly measures = createMeasureForm(this.review);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    this.measures.markAllAsTouched();
    if (this.saving()) return;

    const updated: Review = { ...this.review, ...measureValues(this.measures) };

    this.saving.set(true);
    this.error.set(null);
    const result = await this.data.save(updated);
    this.saving.set(false);

    if (result.ok) this.ref.close(true);
    else this.error.set(result.error.message);
  }

  protected cancel(): void {
    if (!this.saving()) this.ref.close(false);
  }
}
