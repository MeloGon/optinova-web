import { DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideDynamicIcon, LucideTriangleAlert } from '@lucide/angular';
import { SessionStore } from '../../../core/auth/session.store';
import { ConfigService } from '../../../core/config/config.service';
import { Patient } from '../../../core/models/patient';
import { PatientRepository } from '../../../core/repositories/patient.repository';
import { ConfirmService } from '../../../shared/ui/dialog/confirm.service';
import { DatePicker } from '../../../shared/ui/date-picker/date-picker';
import { Field } from '../../../shared/ui/field/field';
import { OnvInput } from '../../../shared/ui/field/input';
import { notBlank, notFuture, optionalPhoneValidator, phoneValidator, today } from './patient-validators';

export const ADD_PATIENT_TITLE_ID = 'add-patient-title';

export const GENDERS = ['Masculino', 'Femenino', 'Otro'] as const;

/** "2026-10-14" → "14/10/2026". */
function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Agregar paciente (= AddPatientDialog de Flutter, antes una página propia). = AddPatientView.
 * Mismo molde que `EditPatientDialog`: se abre con el `Dialog` del CDK, Enter guarda y Esc cancela.
 * Nombre y observaciones se guardan en MAYÚSCULAS para que coincidan con los datos históricos.
 */
@Component({
  selector: 'app-add-patient-dialog',
  imports: [ReactiveFormsModule, LucideDynamicIcon, DatePicker, Field, OnvInput],
  templateUrl: './add-patient-dialog.html',
  host: {
    class: 'block w-[560px] max-w-[calc(100vw-2rem)] rounded-xl bg-card text-card-foreground elev-xl',
    '(keydown.escape)': 'cancel()',
  },
})
export class AddPatientDialog {
  private readonly repo = inject(PatientRepository);
  private readonly session = inject(SessionStore);
  private readonly config = inject(ConfigService);
  private readonly confirm = inject(ConfirmService);
  private readonly ref = inject<DialogRef<Patient | false>>(DialogRef);

  protected readonly titleId = ADD_PATIENT_TITLE_ID;
  protected readonly genders = GENDERS;
  protected readonly today = today();
  protected readonly alertIcon = LucideTriangleAlert;

  /** Solo admin y megadmin cambian la sucursal: los demás registran en la suya. */
  protected readonly canChangeBranch = this.session.can('admin');

  /** Sucursales activas; la del usuario siempre está, aunque estuviera cerrada. */
  protected readonly branches = computed(() => {
    const options = this.config.activeBranches();
    const own = this.session.profile()?.branch;
    return !own || options.some((b) => b.value === own)
      ? options
      : [...options, { value: own, label: own, active: false }];
  });

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [notBlank] }),
    phone: new FormControl('', { nonNullable: true, validators: [phoneValidator] }),
    secondaryPhone: new FormControl('', { nonNullable: true, validators: [optionalPhoneValidator] }),
    gender: new FormControl('', { nonNullable: true }),
    birthDate: new FormControl('', { nonNullable: true, validators: [notFuture] }),
    branch: new FormControl(this.session.profile()?.branch ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    observations: new FormControl('', { nonNullable: true }),
  });

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    if (!this.canChangeBranch) this.form.controls.branch.disable();
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    const v = this.form.getRawValue();
    const name = v.name.trim().replace(/\s+/g, ' ').toUpperCase();

    // Las revisiones y ventas se enlazan por nombre: un nombre repetido mezclaría el historial.
    const duplicates = await this.repo.findByName(name);
    if (duplicates.ok && duplicates.value.length > 0) {
      const registered = formatDate(duplicates.value[0].registeredOn);
      const proceed = await this.confirm.confirm({
        title: `Ya existe un paciente llamado ${name}`,
        text: `Se registró el ${registered}. Las medidas y ventas se enlazan por nombre, así que se mezclarían con las de este. ¿Crear de todos modos?`,
        confirmLabel: 'Crear de todos modos',
        tone: 'primary',
      });
      if (!proceed) return;
    }

    this.saving.set(true);
    this.error.set(null);
    const result = await this.repo.create({
      name,
      phone: v.phone.trim(),
      secondaryPhone: v.secondaryPhone.trim(),
      gender: v.gender,
      birthDate: v.birthDate || null,
      branch: v.branch,
      observations: v.observations.trim().toUpperCase(),
    });
    this.saving.set(false);

    if (result.ok) this.ref.close(result.value);
    else this.error.set(result.error.message);
  }

  protected cancel(): void {
    if (!this.saving()) this.ref.close(false);
  }
}
