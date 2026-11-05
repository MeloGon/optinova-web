/**
 * Armazón del catálogo (= MountModel de Flutter; tabla `armazones`).
 *
 * `id` viaja como texto, no número: `armazones.id` es `bigint` y los IDs viejos de PROD son
 * números de hasta 17 dígitos al azar (antes de la secuencia del cambio #18), más grandes de lo
 * que JavaScript puede guardar exacto. Mismo motivo que `Patient.id`/`Review.patientId` (ver
 * `supabase-patient.repository`). Hallazgo de Codex, 2026-11-05.
 */
export interface Mount {
  id: string;
  brand: string;
  model: string;
  color: string;
  description: string;
  price: number;
  /** Sucursal donde está el armazón (`armazones.sucursal`; no todas las filas la tienen). */
  branch: string;
  barcode: string;
  stock: number;
}
