import { AbstractControl, FormControl, FormGroup, ValidationErrors } from '@angular/forms';
import { Review } from '../../../core/models/review';

/**
 * Las medidas de una revisión: todo lo que se editó en Add/EditReviewWidget de Flutter, menos
 * paciente, sucursal y fecha (esos no se tocan desde este formulario).
 */
export type MeasureFormGroup = FormGroup<{
  reasonConsult: FormControl<string>;
  clinicHistory: FormControl<string>;
  graduationType: FormControl<string>;
  optometricDiagnosis: FormControl<string>;
  odEsf: FormControl<string>;
  odCil: FormControl<string>;
  odEje: FormControl<string>;
  odAv: FormControl<string>;
  oiEsf: FormControl<string>;
  oiCil: FormControl<string>;
  oiEje: FormControl<string>;
  oiAv: FormControl<string>;
  addition: FormControl<string>;
  dip: FormControl<string>;
  odCbLc: FormControl<string>;
  odDiamLc: FormControl<string>;
  oiCbLc: FormControl<string>;
  oiDiamLc: FormControl<string>;
  avSinRxOdLejos: FormControl<string>;
  avSinRxOiLejos: FormControl<string>;
  cvOdLejos: FormControl<string>;
  cvOiLejos: FormControl<string>;
  avSinRxOdCerca: FormControl<string>;
  avSinRxOiCerca: FormControl<string>;
  avConRxOdCerca: FormControl<string>;
  avConRxOiCerca: FormControl<string>;
  observations: FormControl<string>;
}>;

function control(value: string): FormControl<string> {
  return new FormControl(value, { nonNullable: true });
}

/** EJE (P-05 Graduación): entero 0–180. Vacío es válido (no toda medida trae refracción). */
const axisRange = (c: AbstractControl<string>): ValidationErrors | null => {
  const raw = c.value.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 180 ? null : { range: true };
};

function axisControl(value: string): FormControl<string> {
  return new FormControl(value, { nonNullable: true, validators: [axisRange] });
}

export function createMeasureForm(initial?: Review): MeasureFormGroup {
  return new FormGroup({
    reasonConsult: control(initial?.reasonConsult ?? ''),
    clinicHistory: control(initial?.clinicHistory ?? ''),
    graduationType: control(initial?.graduationType ?? ''),
    optometricDiagnosis: control(initial?.optometricDiagnosis ?? ''),
    odEsf: control(initial?.odEsf ?? ''),
    odCil: control(initial?.odCil ?? ''),
    odEje: axisControl(initial?.odEje ?? ''),
    odAv: control(initial?.odAv ?? ''),
    oiEsf: control(initial?.oiEsf ?? ''),
    oiCil: control(initial?.oiCil ?? ''),
    oiEje: axisControl(initial?.oiEje ?? ''),
    oiAv: control(initial?.oiAv ?? ''),
    addition: control(initial?.addition ?? ''),
    dip: control(initial?.dip ?? ''),
    odCbLc: control(initial?.odCbLc ?? ''),
    odDiamLc: control(initial?.odDiamLc ?? ''),
    oiCbLc: control(initial?.oiCbLc ?? ''),
    oiDiamLc: control(initial?.oiDiamLc ?? ''),
    avSinRxOdLejos: control(initial?.avSinRxOdLejos ?? ''),
    avSinRxOiLejos: control(initial?.avSinRxOiLejos ?? ''),
    cvOdLejos: control(initial?.cvOdLejos ?? ''),
    cvOiLejos: control(initial?.cvOiLejos ?? ''),
    avSinRxOdCerca: control(initial?.avSinRxOdCerca ?? ''),
    avSinRxOiCerca: control(initial?.avSinRxOiCerca ?? ''),
    avConRxOdCerca: control(initial?.avConRxOdCerca ?? ''),
    avConRxOiCerca: control(initial?.avConRxOiCerca ?? ''),
    observations: control(initial?.observations ?? ''),
  });
}

/** Valores del formulario, sin espacios sobrantes. */
export function measureValues(form: MeasureFormGroup) {
  const v = form.getRawValue();
  return Object.fromEntries(Object.entries(v).map(([key, value]) => [key, value.trim()])) as typeof v;
}
