import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { LucideDynamicIcon, LucideTriangleAlert } from '@lucide/angular';
import { ConfigService } from '../../../core/config/config.service';
import { AppError } from '../../../core/errors/app-error';
import { Patient } from '../../../core/models/patient';
import { Result } from '../../../core/result';
import { Field } from '../../../shared/ui/field/field';
import { OnvInput } from '../../../shared/ui/field/input';

export interface EditPatientDialogData {
  patient: Patient;
  /** Guarda los cambios. El diálogo se queda abierto, mostrando el error, si falla. */
  save: (patient: Patient) => Promise<Result<void, AppError>>;
}

export const EDIT_PATIENT_TITLE_ID = 'edit-patient-title';

export const GENDERS = ['Masculino', 'Femenino', 'Otro'] as const;

/** Hoy como `yyyy-MM-dd` en hora local (formato del `<input type="date">`). */
function today(): string {
  return new Date().toLocaleDateString('en-CA');
}

const notBlank = (control: AbstractControl<string>): ValidationErrors | null =>
  control.value.trim() ? null : { required: true };

const notFuture = (control: AbstractControl<string>): ValidationErrors | null =>
  control.value && control.value > today() ? { future: true } : null;

/**
 * Editar paciente (C-12 con formulario). = EditPatientDialog de Flutter.
 * Se abre con el `Dialog` del CDK desde la página; Enter guarda y Esc cancela.
 */
@Component({
  selector: 'app-edit-patient-dialog',
  imports: [ReactiveFormsModule, LucideDynamicIcon, Field, OnvInput],
  templateUrl: './edit-patient-dialog.html',
  host: {
    class: 'block w-[560px] max-w-[calc(100vw-2rem)] rounded-xl bg-card text-card-foreground elev-xl',
    '(keydown.escape)': 'cancel()',
  },
})
export class EditPatientDialog {
  private readonly data = inject<EditPatientDialogData>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly config = inject(ConfigService);

  protected readonly patient = this.data.patient;
  protected readonly titleId = EDIT_PATIENT_TITLE_ID;
  protected readonly genders = GENDERS;
  protected readonly today = today();
  protected readonly alertIcon = LucideTriangleAlert;

  /** Sucursales activas; si el paciente tiene una cerrada (OFTALMIC CENTER) se conserva para no perderla. */
  protected readonly branches = computed(() => {
    const options = this.config.activeBranches();
    const current = this.patient.branch;
    return !current || options.some((b) => b.value === current)
      ? options
      : [...options, { value: current, label: current, active: false }];
  });

  protected readonly form = new FormGroup({
    name: new FormControl(this.patient.name, { nonNullable: true, validators: [notBlank] }),
    phone: new FormControl(this.patient.phone, { nonNullable: true }),
    gender: new FormControl(this.patient.gender, { nonNullable: true }),
    birthDate: new FormControl(this.patient.birthDate ?? '', { nonNullable: true, validators: [notFuture] }),
    branch: new FormControl(this.patient.branch, { nonNullable: true, validators: [Validators.required] }),
    observations: new FormControl(this.patient.observations, { nonNullable: true }),
  });

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    const v = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    const result = await this.data.save({
      ...this.patient,
      name: v.name.trim(),
      phone: v.phone.trim(),
      gender: v.gender,
      birthDate: v.birthDate || null,
      branch: v.branch,
      observations: v.observations.trim(),
    });
    this.saving.set(false);

    if (result.ok) this.ref.close(true);
    else this.error.set(result.error.message);
  }

  protected cancel(): void {
    if (!this.saving()) this.ref.close(false);
  }
}
