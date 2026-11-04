import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideDynamicIcon, LucideTriangleAlert } from '@lucide/angular';
import { ConfigService } from '../../../core/config/config.service';
import { AppError } from '../../../core/errors/app-error';
import { Mount } from '../../../core/models/mount';
import { NewMount } from '../../../core/repositories/mount.repository';
import { Result } from '../../../core/result';
import { Field } from '../../../shared/ui/field/field';
import { OnvInput } from '../../../shared/ui/field/input';

export interface MountFormDialogData {
  /** null = nuevo armazón. */
  mount: Mount | null;
  save: (draft: NewMount) => Promise<Result<unknown, AppError>>;
}

export const MOUNT_FORM_TITLE_ID = 'mount-form-title';

/**
 * Alta / editar armazón (C-12 con formulario, un solo diálogo para ambos casos). Mejora
 * consciente frente a Flutter: ahí el diálogo de alta nunca deja escribir el código de barras
 * (siempre guardaba un texto fijo de prueba); acá es un campo real desde el principio.
 */
@Component({
  selector: 'app-mount-form-dialog',
  imports: [ReactiveFormsModule, LucideDynamicIcon, Field, OnvInput],
  templateUrl: './mount-form-dialog.html',
  host: {
    class: 'block w-[560px] max-w-[calc(100vw-2rem)] rounded-xl bg-card text-card-foreground elev-xl',
    '(keydown.escape)': 'cancel()',
  },
})
export class MountFormDialog {
  private readonly data = inject<MountFormDialogData>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly config = inject(ConfigService).config;

  protected readonly titleId = MOUNT_FORM_TITLE_ID;
  protected readonly alertIcon = LucideTriangleAlert;
  protected readonly isEditing = this.data.mount !== null;
  protected readonly branches = this.config().branches;

  protected readonly form = new FormGroup({
    brand: new FormControl(this.data.mount?.brand ?? '', { nonNullable: true, validators: [Validators.required] }),
    model: new FormControl(this.data.mount?.model ?? '', { nonNullable: true, validators: [Validators.required] }),
    color: new FormControl(this.data.mount?.color ?? '', { nonNullable: true }),
    description: new FormControl(this.data.mount?.description ?? '', { nonNullable: true }),
    price: new FormControl<number | null>(this.data.mount?.price ?? null, [Validators.required, Validators.min(0)]),
    stock: new FormControl<number | null>(this.data.mount?.stock ?? 0, [Validators.required, Validators.min(0)]),
    branch: new FormControl(this.data.mount?.branch ?? '', { nonNullable: true }),
    barcode: new FormControl(this.data.mount?.barcode ?? '', { nonNullable: true }),
  });

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    const value = this.form.getRawValue();
    const draft: NewMount = {
      brand: value.brand.trim(),
      model: value.model.trim(),
      color: value.color.trim(),
      description: value.description.trim(),
      price: value.price ?? 0,
      stock: value.stock ?? 0,
      branch: value.branch,
      barcode: value.barcode.trim(),
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
