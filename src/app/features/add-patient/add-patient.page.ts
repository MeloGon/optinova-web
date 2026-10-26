import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon, LucideEraser, LucideUserPlus } from '@lucide/angular';
import { map, startWith } from 'rxjs';
import { SessionStore } from '../../core/auth/session.store';
import { ConfigService } from '../../core/config/config.service';
import { Badge } from '../../shared/ui/badge/badge';
import { ConfirmService } from '../../shared/ui/dialog/confirm.service';
import { Field } from '../../shared/ui/field/field';
import { OnvInput } from '../../shared/ui/field/input';
import { Segmented, SegmentedOption } from '../../shared/ui/segmented/segmented';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { AddPatientStore } from './add-patient.store';

/** Hoy como `yyyy-MM-dd` en hora local (formato del `<input type="date">`). */
function today(): string {
  return new Date().toLocaleDateString('en-CA');
}

/** "2026-10-14" → "14/10/2026". */
function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

const notBlank = (control: AbstractControl<string>): ValidationErrors | null =>
  control.value.trim() ? null : { required: true };

/** Teléfono: solo dígitos, espacios, +, - y paréntesis; entre 6 y 15 dígitos. */
const phoneFormat = (value: string): boolean => {
  if (!/^[\d\s+()-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, '').length;
  return digits >= 6 && digits <= 15;
};

const phoneValidator = (control: AbstractControl<string>): ValidationErrors | null => {
  const value = control.value.trim();
  if (!value) return { required: true };
  return phoneFormat(value) ? null : { phone: true };
};

/** Igual, pero puede quedar vacío. */
const optionalPhoneValidator = (control: AbstractControl<string>): ValidationErrors | null => {
  const value = control.value.trim();
  return !value || phoneFormat(value) ? null : { phone: true };
};

const notFuture = (control: AbstractControl<string>): ValidationErrors | null =>
  control.value && control.value > today() ? { future: true } : null;

/** "ana maría  lópez" → "AM": iniciales de la primera y la última palabra. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/**
 * Agregar paciente (S-03, alta). = AddPatientView de Flutter.
 * Nombre y observaciones se guardan en MAYÚSCULAS, como en Flutter, para que los datos nuevos
 * se vean igual que los históricos.
 */
@Component({
  selector: 'app-add-patient-page',
  imports: [ReactiveFormsModule, DatePipe, RouterLink, LucideDynamicIcon, Badge, Field, OnvInput, Segmented],
  providers: [AddPatientStore],
  templateUrl: './add-patient.page.html',
})
export class AddPatientPage {
  protected readonly store = inject(AddPatientStore);
  private readonly session = inject(SessionStore);
  private readonly config = inject(ConfigService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly today = today();
  protected readonly formatDate = formatDate;
  protected readonly icons = { save: LucideUserPlus, clear: LucideEraser };

  protected readonly genders: SegmentedOption[] = [
    { value: 'Masculino', label: 'Masculino' },
    { value: 'Femenino', label: 'Femenino' },
    { value: 'Otro', label: 'Otro' },
  ];

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

  /** Lo escrito hasta ahora, para la vista previa. */
  protected readonly draft = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => this.form.getRawValue()),
    ),
    { initialValue: this.form.getRawValue() },
  );
  protected readonly initials = computed(() => initialsOf(this.draft().name));

  constructor() {
    if (!this.canChangeBranch) this.form.controls.branch.disable();
    effect(() => untracked(() => void this.store.loadLatest()));
  }

  protected async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.store.saving()) return;

    const v = this.form.getRawValue();
    const name = v.name.trim().replace(/\s+/g, ' ').toUpperCase();

    // Las revisiones y ventas se enlazan por nombre: un nombre repetido mezclaría el historial.
    const duplicates = await this.store.findDuplicates(name);
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

    const result = await this.store.create({
      name,
      phone: v.phone.trim(),
      secondaryPhone: v.secondaryPhone.trim(),
      gender: v.gender,
      birthDate: v.birthDate || null,
      branch: v.branch,
      observations: v.observations.trim().toUpperCase(),
    });

    if (result.ok) {
      this.toast.show({ tone: 'success', title: 'Paciente creado', text: name });
      this.clear();
    } else {
      this.toast.show({ tone: 'danger', title: 'No se pudo crear el paciente', text: result.error.message });
    }
  }

  protected clear(): void {
    this.form.reset({ branch: this.session.profile()?.branch ?? '' });
  }
}
