import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { LucideDynamicIcon, LucideTriangleAlert } from '@lucide/angular';
import { AppError } from '../../../core/errors/app-error';
import { Patient } from '../../../core/models/patient';
import { Review } from '../../../core/models/review';
import { NewReview } from '../../../core/repositories/review.repository';
import { Result } from '../../../core/result';
import { Field } from '../../../shared/ui/field/field';
import { OnvInput } from '../../../shared/ui/field/input';
import { createMeasureForm, measureValues } from './measure-form';
import { MeasureFields } from './measure-fields';

export interface AddReviewDialogData {
  patient: Patient;
  save: (review: NewReview) => Promise<Result<Review, AppError>>;
}

export const ADD_REVIEW_TITLE_ID = 'add-review-title';

/** Hoy como `yyyy-MM-dd`, igual que en EditPatientDialog. */
function today(): string {
  return new Date().toLocaleDateString('en-CA');
}

const notFuture = (control: AbstractControl<string>): ValidationErrors | null =>
  control.value && control.value > today() ? { future: true } : null;

/**
 * Agregar medida (C-12 con formulario). = AddReviewDialog de Flutter.
 * Se abre desde el menú de un paciente en Buscar paciente.
 */
@Component({
  selector: 'app-add-review-dialog',
  imports: [ReactiveFormsModule, LucideDynamicIcon, Field, OnvInput, MeasureFields],
  templateUrl: './add-review-dialog.html',
  host: {
    class: 'block w-[640px] max-w-[calc(100vw-2rem)] rounded-xl bg-card text-card-foreground elev-xl',
    '(keydown.escape)': 'cancel()',
  },
})
export class AddReviewDialog {
  private readonly data = inject<AddReviewDialogData>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<boolean>>(DialogRef);

  protected readonly patient = this.data.patient;
  protected readonly titleId = ADD_REVIEW_TITLE_ID;
  protected readonly today = today();
  protected readonly alertIcon = LucideTriangleAlert;

  protected readonly date = new FormControl(this.today, { nonNullable: true, validators: [notFuture] });
  protected readonly measures = createMeasureForm();
  protected readonly form = new FormGroup({ date: this.date });

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    this.measures.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    const review: NewReview = {
      patientId: this.patient.id,
      patientName: this.patient.name,
      branch: this.patient.branch,
      date: this.date.value,
      ...measureValues(this.measures),
    };

    this.saving.set(true);
    this.error.set(null);
    const result = await this.data.save(review);
    this.saving.set(false);

    if (result.ok) this.ref.close(true);
    else this.error.set(result.error.message);
  }

  protected cancel(): void {
    if (!this.saving()) this.ref.close(false);
  }
}
