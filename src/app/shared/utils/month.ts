const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Enero, Febrero... para el select de mes (no depende del año elegido). */
export const MONTH_OPTIONS = MONTH_NAMES.map((label, index) => ({ value: String(index + 1).padStart(2, '0'), label }));

/** `yyyy-MM` de hoy, para abrir siempre en el mes en curso (= el resto de los reportes de la app). */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function toMonth(value: string | undefined): string {
  return value && /^\d{4}-\d{2}$/.test(value) ? value : currentMonth();
}

/** "2026-11" → "Noviembre 2026". */
export function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-');
  return `${MONTH_NAMES[Number(monthNumber) - 1]} ${year}`;
}

/**
 * "2026-11" → primer y último día del mes, ambos `yyyy-MM-dd`.
 *
 * `Date.UTC(...)`, no `new Date(...)`: con huso horario positivo (GMT+1 a GMT+14), construir la
 * fecha en hora local y después pasarla a ISO le resta un día (`toISOString` retrocede hasta UTC).
 * Hallazgo de Antigravity, 2026-11-04.
 */
export function monthRange(month: string): { from: string; to: string } {
  const [year, monthNumber] = month.split('-').map(Number);
  const from = `${month}-01`;
  const to = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
  return { from, to };
}

/** Años para el selector: de este hacia 10 atrás (suficiente para datos históricos tras el corte). */
export function yearOptions(): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: 11 }, (_, i) => current - i);
}

/** `yyyy-MM-dd` de hoy, en hora local (no UTC: evita que a medianoche caiga en el día anterior). */
export function today(): string {
  return new Date().toLocaleDateString('en-CA');
}
