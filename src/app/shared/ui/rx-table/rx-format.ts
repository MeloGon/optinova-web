// P-05 Graduación: formato de los valores (signo explícito, atajo de captura).

function parseNumber(raw: string): number | null {
  // El signo menos tipográfico (−, U+2212) que pone formatDiopter() no lo entiende Number():
  // sin este reemplazo, parsear un valor ya formateado (al volver a pisar ↑/↓) daba NaN y el
  // paso siguiente arrancaba de 0 en vez del valor actual.
  const t = raw.trim().replace(',', '.').replace(/−/g, '-');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Tono visual del valor: lleva el signo, pero el color solo refuerza. */
export type RxTone = 'pos' | 'neg' | 'zero' | 'empty' | 'text';

export function rxTone(raw: string): RxTone {
  const n = parseNumber(raw);
  if (n === null) return raw.trim() ? 'text' : 'empty';
  if (n === 0) return 'zero';
  return n > 0 ? 'pos' : 'neg';
}

/** ESF, CIL, ADD: signo siempre explícito, con el signo menos tipográfico (−, no -). */
export function formatDiopter(raw: string): string {
  const n = parseNumber(raw);
  if (n === null) return raw.trim() || '—';
  if (n === 0) return '0.00';
  return `${n > 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}`;
}

/** EJE: entero 0–180 con el símbolo de grado. */
export function formatAxis(raw: string): string {
  const n = parseNumber(raw);
  if (n === null) return raw.trim() || '—';
  return `${Math.round(n)}°`;
}

export function formatText(raw: string): string {
  return raw.trim() || '—';
}

/**
 * Normaliza lo que se escribe en ESF/CIL/ADD al dejar el campo.
 * Atajo de captura rápida: solo dígitos y sin punto se leen como centésimas
 * ("125" → "1.25", "-125" → "−1.25", "50" → "0.50"), igual que pedía P-05.
 */
export function normalizeDiopterInput(raw: string): string {
  const t = raw.trim();
  if (!t) return '';

  const negative = t.startsWith('-') || t.startsWith('−');
  const digits = t.replace(/^[-−+]/, '');

  if (/^\d+$/.test(digits)) {
    const cents = digits.padStart(3, '0');
    const value = Number(`${cents.slice(0, -2)}.${cents.slice(-2)}`);
    return formatDiopter(String(negative ? -value : value));
  }
  return formatDiopter(t);
}

/** Suma `delta` al valor numérico actual (steppers ↑/↓) y devuelve el texto ya formateado. */
export function stepDiopter(raw: string, delta: number): string {
  const n = parseNumber(raw) ?? 0;
  return formatDiopter(String(Math.round((n + delta) * 100) / 100));
}

export function stepAxis(raw: string, delta: number): string {
  const n = parseNumber(raw) ?? 0;
  const next = Math.max(0, Math.min(180, Math.round(n + delta)));
  return String(next);
}
