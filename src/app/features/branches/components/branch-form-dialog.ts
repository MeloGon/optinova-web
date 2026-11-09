import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideDynamicIcon, LucideTriangleAlert } from '@lucide/angular';
import { AppError } from '../../../core/errors/app-error';
import { ManagedBranch } from '../../../core/models/managed-branch';
import { Result } from '../../../core/result';
import { Field } from '../../../shared/ui/field/field';
import { OnvInput } from '../../../shared/ui/field/input';

export interface BranchFormDialogData {
  /** null = sucursal nueva. */
  branch: ManagedBranch | null;
  /** Empresa a la que pertenece (se muestra para que un megadmin sepa dónde crea). */
  companyName: string;
  save: (name: string) => Promise<Result<unknown, AppError>>;
}

export const BRANCH_FORM_TITLE_ID = 'branch-form-title';

/**
 * Nueva sucursal / renombrar (C-12 con formulario). Renombrar actualiza el nombre en todo el
 * historial de la sucursal (ventas, pacientes, revisiones...): puede tardar unos segundos, así que
 * avisa antes y, mientras guarda, muestra un contador de segundos. Cierra con el tiempo que tardó
 * (ms) para que la página lo muestre; `null` = canceló.
 */
@Component({
  selector: 'app-branch-form-dialog',
  imports: [ReactiveFormsModule, LucideDynamicIcon, Field, OnvInput],
  templateUrl: './branch-form-dialog.html',
  host: {
    class: 'block w-[460px] max-w-[calc(100vw-2rem)] rounded-xl bg-card text-card-foreground elev-xl',
    '(keydown.escape)': 'cancel()',
  },
})
export class BranchFormDialog implements OnDestroy {
  private readonly data = inject<BranchFormDialogData>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<number | null>>(DialogRef);

  protected readonly titleId = BRANCH_FORM_TITLE_ID;
  protected readonly alertIcon = LucideTriangleAlert;
  protected readonly isEditing = this.data.branch !== null;
  protected readonly companyName = this.data.companyName;

  protected readonly form = new FormGroup({
    name: new FormControl(this.data.branch?.name ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(60)],
    }),
  });

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly elapsedSeconds = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Renombrar una sucursal con otro nombre es lo único que mueve el historial. */
  protected get renaming(): boolean {
    const name = this.form.controls.name.value.trim().replace(/\s+/g, ' ').toUpperCase();
    return this.isEditing && name !== '' && name !== this.data.branch?.name;
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    const name = this.form.controls.name.value.trim();
    if (this.isEditing && !this.renaming) {
      this.ref.close(0);
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.elapsedSeconds.set(0);
    const startedAt = Date.now();
    this.timer = setInterval(() => this.elapsedSeconds.set(Math.floor((Date.now() - startedAt) / 1000)), 500);

    const result = await this.data.save(name);

    this.stopTimer();
    this.saving.set(false);

    if (result.ok) this.ref.close(Date.now() - startedAt);
    else this.error.set(result.error.message);
  }

  protected cancel(): void {
    if (!this.saving()) this.ref.close(null);
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  private stopTimer(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }
}
