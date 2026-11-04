import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideDynamicIcon, LucideTriangleAlert } from '@lucide/angular';
import { AppError } from '../../../core/errors/app-error';
import { Resin } from '../../../core/models/resin';
import { NewResin } from '../../../core/repositories/resin.repository';
import { Result } from '../../../core/result';
import { Field } from '../../../shared/ui/field/field';
import { OnvInput } from '../../../shared/ui/field/input';

export interface ResinFormDialogData {
  /** null = nueva resina. */
  resin: Resin | null;
  save: (draft: NewResin) => Promise<Result<unknown, AppError>>;
}

export const RESIN_FORM_TITLE_ID = 'resin-form-title';

/**
 * Alta / editar resina (C-12 con formulario, un solo diálogo para ambos casos, según si llega
 * `resin`). `text` (el nombre buscable) no se pide: lo arma el repositorio con el resto de campos.
 */
@Component({
  selector: 'app-resin-form-dialog',
  imports: [ReactiveFormsModule, LucideDynamicIcon, Field, OnvInput],
  templateUrl: './resin-form-dialog.html',
  host: {
    class: 'block w-[560px] max-w-[calc(100vw-2rem)] rounded-xl bg-card text-card-foreground elev-xl',
    '(keydown.escape)': 'cancel()',
  },
})
export class ResinFormDialog {
  private readonly data = inject<ResinFormDialogData>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<boolean>>(DialogRef);

  protected readonly titleId = RESIN_FORM_TITLE_ID;
  protected readonly alertIcon = LucideTriangleAlert;
  protected readonly isEditing = this.data.resin !== null;

  protected readonly form = new FormGroup({
    description: new FormControl(this.data.resin?.description ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    design: new FormControl(this.data.resin?.design ?? '', { nonNullable: true }),
    line: new FormControl(this.data.resin?.line ?? '', { nonNullable: true }),
    material: new FormControl(this.data.resin?.material ?? '', { nonNullable: true }),
    technology: new FormControl(this.data.resin?.technology ?? '', { nonNullable: true }),
    price: new FormControl<number | null>(this.data.resin?.price ?? null, [Validators.required, Validators.min(0)]),
    priceInternal: new FormControl<number | null>(this.data.resin?.priceInternal ?? null, [Validators.min(0)]),
    quantity: new FormControl<number | null>(this.data.resin?.quantity ?? 0, [Validators.required, Validators.min(0)]),
  });

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    const value = this.form.getRawValue();
    const draft: NewResin = {
      description: value.description.trim(),
      design: value.design.trim(),
      line: value.line.trim(),
      material: value.material.trim(),
      technology: value.technology.trim(),
      price: value.price ?? 0,
      priceInternal: value.priceInternal ?? 0,
      quantity: value.quantity ?? 0,
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
