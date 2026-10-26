/**
 * Paciente (= PatientModel de Flutter).
 * Las fechas son texto ISO `yyyy-MM-dd` (columnas `date`): sin hora ni zona horaria, así que
 * no hay desfases. Se convierten a `Date` solo para mostrarlas.
 */
export interface Patient {
  id: number;
  name: string;
  /** Texto de `pacientes.SUCURSAL` (OFTALVISION, MEDILENT...). */
  branch: string;
  phone: string;
  gender: string;
  observations: string;
  /** Cuándo se registró al cliente. */
  registeredOn: string;
  /** Puede faltar: la mayoría de los pacientes históricos no la tiene. */
  birthDate: string | null;
}
