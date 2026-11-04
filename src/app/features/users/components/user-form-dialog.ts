import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideDynamicIcon, LucideTriangleAlert } from '@lucide/angular';
import { ConfigService } from '../../../core/config/config.service';
import { AppError } from '../../../core/errors/app-error';
import { ManagedUser } from '../../../core/models/managed-user';
import { ROLES, Role } from '../../../core/models/role';
import { Result } from '../../../core/result';
import { Field } from '../../../shared/ui/field/field';
import { OnvInput } from '../../../shared/ui/field/input';

/** El diálogo siempre manda esta forma completa; "editar" ignora email/password al guardar. */
export interface UserFormPayload {
  name: string;
  branch: string | null;
  role: Role;
  email: string;
  password: string;
}

export interface UserFormDialogData {
  /** null = nuevo usuario. */
  user: ManagedUser | null;
  save: (draft: UserFormPayload) => Promise<Result<unknown, AppError>>;
  /** El propio megadmin editando su fila: el servidor ya lo rechaza, pero no tiene sentido ofrecerlo. */
  disableRoleChange?: boolean;
}

export const USER_FORM_TITLE_ID = 'user-form-title';
const ROLE_LABELS: Record<Role, string> = {
  vendedor: 'Vendedor',
  supervisor: 'Supervisor',
  admin: 'Admin',
  megadmin: 'Megadmin',
};

/**
 * Alta / editar usuario (C-12 con formulario, un solo diálogo para ambos casos). Correo y
 * contraseña solo se piden al crear: Supabase Auth no deja cambiar el correo desde aquí y la
 * contraseña tiene su propio diálogo ("Restablecer contraseña"), igual que Flutter.
 */
@Component({
  selector: 'app-user-form-dialog',
  imports: [ReactiveFormsModule, LucideDynamicIcon, Field, OnvInput],
  templateUrl: './user-form-dialog.html',
  host: {
    class: 'block w-[480px] max-w-[calc(100vw-2rem)] rounded-xl bg-card text-card-foreground elev-xl',
    '(keydown.escape)': 'cancel()',
  },
})
export class UserFormDialog {
  private readonly data = inject<UserFormDialogData>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly config = inject(ConfigService).config;

  protected readonly titleId = USER_FORM_TITLE_ID;
  protected readonly alertIcon = LucideTriangleAlert;
  protected readonly isEditing = this.data.user !== null;
  protected readonly branches = this.config().branches;
  protected readonly roles = ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }));
  protected readonly disableRoleChange = this.data.disableRoleChange ?? false;

  protected readonly form = new FormGroup({
    name: new FormControl(this.data.user?.name ?? '', { nonNullable: true, validators: [Validators.required] }),
    branch: new FormControl(this.data.user?.branch ?? '', { nonNullable: true }),
    role: new FormControl<Role>(
      { value: this.data.user?.role ?? 'vendedor', disabled: this.data.disableRoleChange ?? false },
      { nonNullable: true },
    ),
    email: new FormControl('', {
      nonNullable: true,
      validators: this.isEditing ? [] : [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: this.isEditing ? [] : [Validators.required, Validators.minLength(6)],
    }),
  });

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    const value = this.form.getRawValue();
    const draft: UserFormPayload = {
      name: value.name.trim(),
      branch: value.branch || null,
      role: value.role,
      email: value.email.trim(),
      password: value.password,
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
