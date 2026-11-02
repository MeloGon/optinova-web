import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideDynamicIcon, LucideTriangleAlert } from '@lucide/angular';
import { AppError } from '../../../core/errors/app-error';
import { Result } from '../../../core/result';
import { Field } from '../../../shared/ui/field/field';
import { OnvInput } from '../../../shared/ui/field/input';

export interface SupervisorAuthDialogData {
  patientName: string;
  reviewCount: number;
  /** Verifica las credenciales e intenta la acción. El diálogo se queda abierto con el error si falla. */
  authorize: (email: string, password: string) => Promise<Result<unknown, AppError>>;
}

export const SUPERVISOR_AUTH_TITLE_ID = 'supervisor-auth-title';

/**
 * Autorización de un supervisor+ (P-04), sin cerrar la sesión del vendedor. = el diálogo de
 * correo/contraseña que Flutter nunca tuvo (ver docs/status.md, decisión del dueño 2026-10-26).
 * Las credenciales se verifican en el Edge Function `patients-lifecycle`, nunca en el navegador.
 */
@Component({
  selector: 'app-supervisor-auth-dialog',
  imports: [ReactiveFormsModule, LucideDynamicIcon, Field, OnvInput],
  templateUrl: './supervisor-auth-dialog.html',
  host: {
    class: 'block w-[420px] max-w-[calc(100vw-2rem)] rounded-xl bg-card text-card-foreground elev-xl',
    '(keydown.escape)': 'cancel()',
  },
})
export class SupervisorAuthDialog {
  protected readonly data = inject<SupervisorAuthDialogData>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<boolean>>(DialogRef);

  protected readonly titleId = SUPERVISOR_AUTH_TITLE_ID;
  protected readonly alertIcon = LucideTriangleAlert;

  protected readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    const { email, password } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    const result = await this.data.authorize(email.trim(), password);
    this.saving.set(false);

    if (result.ok) this.ref.close(true);
    else this.error.set(result.error.message);
  }

  protected cancel(): void {
    if (!this.saving()) this.ref.close(false);
  }
}
