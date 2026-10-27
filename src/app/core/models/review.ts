/**
 * Medida/revisión (= ReviewModel de Flutter).
 * Un paciente puede tener varias; se muestran de la más reciente a la más antigua.
 */
export interface Review {
  /** Texto, no número: igual razón que `Patient.id` (ver ese archivo). */
  id: string;
  /** FK al paciente. Puede faltar en revisiones históricas sin enlazar (ver migración #7). */
  patientId: string | null;
  /** Nombre del paciente al momento de la consulta; respaldo si `patientId` falta. */
  patientName: string;
  branch: string;
  /** Fecha de la consulta (no editable después de crear la medida, igual que en Flutter). */
  date: string;
  reasonConsult: string;
  clinicHistory: string;
  graduationType: string;
  optometricDiagnosis: string;
  odEsf: string;
  odCil: string;
  odEje: string;
  odAv: string;
  oiEsf: string;
  oiCil: string;
  oiEje: string;
  oiAv: string;
  addition: string;
  dip: string;
  odCbLc: string;
  odDiamLc: string;
  oiCbLc: string;
  oiDiamLc: string;
  avSinRxOdLejos: string;
  avSinRxOiLejos: string;
  cvOdLejos: string;
  cvOiLejos: string;
  avSinRxOdCerca: string;
  avSinRxOiCerca: string;
  avConRxOdCerca: string;
  avConRxOiCerca: string;
  observations: string;
}
