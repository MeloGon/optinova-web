import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideDynamicIcon, LucideTriangleAlert } from '@lucide/angular';
import { AppError } from '../../../core/errors/app-error';
import { NewCompany } from '../../../core/repositories/branch-admin.repository';
import { Result } from '../../../core/result';
import { Field } from '../../../shared/ui/field/field';
import { OnvInput } from '../../../shared/ui/field/input';

export interface CompanyWizardDialogData {
  save: (draft: NewCompany) => Promise<Result<unknown, AppError>>;
}

export const COMPANY_WIZARD_TITLE_ID = 'company-wizard-title';

type StepControl = 'name' | 'branch' | 'adminName' | 'adminEmail' | 'adminPassword';

/** Qué campos valida cada paso antes de dejar avanzar. */
const STEP_CONTROLS: StepControl[][] = [['name'], ['branch'], ['adminName', 'adminEmail', 'adminPassword']];
const STEP_TITLES = ['La empresa', 'Su primera sucursal', 'Su administrador'];

/**
 * Alta de empresa en tres pasos (solo megadmin): empresa, primera sucursal y administrador.
 * Los datos se juntan en pantalla y se mandan en un solo envío al final: si se cierra a mitad de
 * camino no queda una empresa a medias en la base (= un Stepper de Flutter con un solo
 * `repository.create(...)` al terminar).
 */
@Component({
  selector: 'app-company-wizard-dialog',
  imports: [ReactiveFormsModule, LucideDynamicIcon, Field, OnvInput],
  templateUrl: './company-wizard-dialog.html',
  host: {
    class: 'block w-[480px] max-w-[calc(100vw-2rem)] rounded-xl bg-card text-card-foreground elev-xl',
    '(keydown.escape)': 'cancel()',
  },
})
export class CompanyWizardDialog {
  private readonly data = inject<CompanyWizardDialogData>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<boolean>>(DialogRef);

  protected readonly titleId = COMPANY_WIZARD_TITLE_ID;
  protected readonly alertIcon = LucideTriangleAlert;
  protected readonly stepTitles = STEP_TITLES;

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    branch: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(60)] }),
    adminName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    adminEmail: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    adminPassword: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
  });

  protected readonly step = signal(0);
  protected readonly isLast = computed(() => this.step() === STEP_CONTROLS.length - 1);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected next(): void {
    if (!this.validateStep()) return;
    this.step.update((s) => Math.min(s + 1, STEP_CONTROLS.length - 1));
  }

  protected back(): void {
    this.error.set(null);
    this.step.update((s) => Math.max(s - 1, 0));
  }

  protected async submit(): Promise<void> {
    if (this.saving()) return;
    if (!this.isLast()) {
      this.next();
      return;
    }
    if (!this.validateStep()) return;

    const v = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    const result = await this.data.save({
      name: v.name.trim(),
      branch: v.branch.trim(),
      adminName: v.adminName.trim(),
      adminEmail: v.adminEmail.trim(),
      adminPassword: v.adminPassword,
    });
    this.saving.set(false);

    if (result.ok) this.ref.close(true);
    else this.error.set(result.error.message);
  }

  protected cancel(): void {
    if (!this.saving()) this.ref.close(false);
  }

  private validateStep(): boolean {
    const controls = STEP_CONTROLS[this.step()].map((key) => this.form.controls[key]);
    controls.forEach((c) => c.markAsTouched());
    return controls.every((c) => c.valid);
  }
}
