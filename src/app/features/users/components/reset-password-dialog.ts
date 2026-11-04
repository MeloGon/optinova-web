import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideDynamicIcon, LucideTriangleAlert } from '@lucide/angular';
import { AppError } from '../../../core/errors/app-error';
import { Result } from '../../../core/result';
import { Field } from '../../../shared/ui/field/field';
import { OnvInput } from '../../../shared/ui/field/input';

export interface ResetPasswordDialogData {
  userName: string;
  save: (newPassword: string) => Promise<Result<unknown, AppError>>;
}

export const RESET_PASSWORD_TITLE_ID = 'reset-password-title';

/** Restablecer contraseña (= _ResetPasswordDialog de Flutter): dos campos, deben coincidir. */
@Component({
  selector: 'app-reset-password-dialog',
  imports: [ReactiveFormsModule, LucideDynamicIcon, Field, OnvInput],
  templateUrl: './reset-password-dialog.html',
  host: {
    class: 'block w-[420px] max-w-[calc(100vw-2rem)] rounded-xl bg-card text-card-foreground elev-xl',
    '(keydown.escape)': 'cancel()',
  },
})
export class ResetPasswordDialog {
  private readonly data = inject<ResetPasswordDialogData>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<boolean>>(DialogRef);

  protected readonly titleId = RESET_PASSWORD_TITLE_ID;
  protected readonly alertIcon = LucideTriangleAlert;
  protected readonly userName = this.data.userName;

  protected readonly form = new FormGroup({
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
    confirm: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    const { password, confirm } = this.form.getRawValue();
    if (password !== confirm) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    const result = await this.data.save(password);
    this.saving.set(false);

    if (result.ok) this.ref.close(true);
    else this.error.set(result.error.message);
  }

  protected cancel(): void {
    if (!this.saving()) this.ref.close(false);
  }
}
