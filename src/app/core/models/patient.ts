/**
 * Paciente (= PatientModel de Flutter).
 * Las fechas son texto ISO `yyyy-MM-dd` (columnas `date`): sin hora ni zona horaria, así que
 * no hay desfases. Se convierten a `Date` solo para mostrarlas.
 */
export interface Patient {
  /**
   * Texto, no número: en PROD hay IDs de 17 dígitos y JavaScript solo guarda enteros exactos
   * hasta 9,007,199,254,740,991. Se pide a la DB con `::text` y nunca se convierte a number.
   */
  id: string;
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
