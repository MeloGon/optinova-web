import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Hoy como `yyyy-MM-dd` en hora local (formato del `<input type="date">`). */
export function today(): string {
  return new Date().toLocaleDateString('en-CA');
}

export const notBlank = (control: AbstractControl<string>): ValidationErrors | null =>
  control.value.trim() ? null : { required: true };

export const notFuture = (control: AbstractControl<string>): ValidationErrors | null =>
  control.value && control.value > today() ? { future: true } : null;

/** Teléfono: solo dígitos, espacios, +, - y paréntesis; entre 6 y 15 dígitos. */
function phoneFormat(value: string): boolean {
  if (!/^[\d\s+()-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, '').length;
  return digits >= 6 && digits <= 15;
}

export const phoneValidator = (control: AbstractControl<string>): ValidationErrors | null => {
  const value = control.value.trim();
  if (!value) return { required: true };
  return phoneFormat(value) ? null : { phone: true };
};

/** Igual, pero puede quedar vacío. */
export const optionalPhoneValidator = (control: AbstractControl<string>): ValidationErrors | null => {
  const value = control.value.trim();
  return !value || phoneFormat(value) ? null : { phone: true };
};
