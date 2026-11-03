import {
  ActivityEntry,
  CollectionBucketKey,
  DashboardPeriod,
  DashboardScope,
  LowStockItem,
} from '../../core/models/dashboard';
import { BadgeTone } from '../../shared/ui/badge/badge';

/** "OAKLEY MOD-014"; sin marca ni modelo usa la descripción, y si tampoco hay, "Armazón sin nombre". */
export function mountName(item: Pick<LowStockItem, 'brand' | 'model' | 'description'>): string {
  const name = `${item.brand} ${item.model}`.trim();
  return name || item.description.trim() || 'Armazón sin nombre';
}

/** "Queda 1" / "Quedan 2": cuántas unidades faltan por agotarse. */
export function stockLabel(stock: number): string {
  return stock === 1 ? 'Queda 1' : `Quedan ${stock}`;
}

/** La última unidad es lo más urgente (danger); con dos hay margen (warning). */
export function stockTone(stock: number): BadgeTone {
  return stock <= 1 ? 'danger' : 'warning';
}

/** Cómo se rotula y se colorea cada tramo de antigüedad de la cobranza. */
export const BUCKET_META: Record<CollectionBucketKey, { label: string; tone: BadgeTone; bar: string }> = {
  recent: { label: '0 a 7 días', tone: 'success', bar: 'bg-success' },
  mid: { label: '8 a 30 días', tone: 'warning', bar: 'bg-warning' },
  old: { label: 'Más de 30 días', tone: 'danger', bar: 'bg-danger' },
};

/** "Hoy", "1 día", "12 días"; una venta sin fecha no tiene antigüedad que decir. */
export function ageLabel(days: number | null): string {
  if (days === null) return 'Sin fecha';
  if (days === 0) return 'Hoy';
  return days === 1 ? '1 día' : `${days} días`;
}

/** Mismo corte que los tramos de la cobranza: hasta 7 días, hasta 30 y más. Sin fecha cuenta como la más antigua. */
export function ageTone(days: number | null): BadgeTone {
  if (days === null || days > 30) return BUCKET_META.old.tone;
  return days > 7 ? BUCKET_META.mid.tone : BUCKET_META.recent.tone;
}

export const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: '7 días' },
  { value: 'month', label: 'Mes' },
];

/** Contra qué se compara cada periodo (lo calcula el servidor con la misma regla). */
export const COMPARE_LABEL: Record<DashboardPeriod, string> = {
  today: 'vs ayer',
  week: 'vs los 7 días previos',
  month: 'vs el mes anterior',
};

/** Cómo se dice el periodo dentro de una frase ("ventas en 7 días"). */
export const PERIOD_NOUN: Record<DashboardPeriod, string> = {
  today: 'hoy',
  week: 'en 7 días',
  month: 'en el mes',
};

/** Cómo se dice el periodo detrás de "de" ("Métodos de pago de hoy"). */
export const PERIOD_OF: Record<DashboardPeriod, string> = {
  today: 'de hoy',
  week: 'de los últimos 7 días',
  month: 'del mes',
};

export interface Variation {
  /** Porcentaje absoluto, redondeado. */
  percent: number;
  direction: 'up' | 'down' | 'flat';
}

/**
 * Cambio porcentual de `current` frente a `previous`. Sin base de comparación (anterior en 0)
 * devuelve null: "100% más que cero" no dice nada y se muestra como "sin comparación".
 */
export function variation(current: number, previous: number): Variation | null {
  if (previous <= 0) return null;
  const percent = Math.round(((current - previous) / previous) * 100);
  return {
    percent: Math.abs(percent),
    direction: percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat',
  };
}

/**
 * "Buenos días" (5–11 h) / "Buenas tardes" (12–18 h) / "Buenas noches" (19–4 h), según la hora
 * en la zona horaria de la empresa. La madrugada es "noches": nadie dice "buenos días" a las 2 a. m.
 */
export function greeting(now: Date, timeZone: string): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(now),
  );
  if (hour >= 5 && hour < 12) return 'Buenos días';
  if (hour >= 12 && hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/** "Vendedor Prueba" → "Vendedor". Vacío si no hay nombre. */
export function firstName(fullName: string | undefined): string {
  return (fullName ?? '').trim().split(/\s+/)[0] ?? '';
}

/** Qué dice el encabezado sobre el alcance de lo que se ve ("Tus ventas", "Sucursal MEDILENT"...). */
export function scopeLabel(scope: DashboardScope, branch: string | null): string {
  if (scope === 'mine') return 'Tus ventas y las de tu cuenta';
  if (scope === 'branch') return `Sucursal ${branch ?? ''}`.trim();
  return branch ? `Sucursal ${branch}` : 'Todas las sucursales';
}

/** "efectivo" → "Efectivo". */
export function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * Frase de una línea de auditoría. En una venta distingue quién la registró (la cuenta con sesión)
 * de a nombre de qué vendedor quedó: pueden ser personas distintas (cuenta prestada).
 */
export function describeActivity(entry: ActivityEntry, formatMoney: (n: number) => string): string {
  const d = entry.detail;
  const folio = text(d['folio']) || entry.entityId;

  switch (entry.action) {
    case 'create_sale': {
      const actor = text(d['creado_por_nombre']) || entry.userEmail;
      const seller = text(d['vendedor']);
      return `${actor} registró la venta ${folio}${seller ? ` (vendedor: ${seller})` : ''}`;
    }
    case 'delete_sale':
      return `${entry.userEmail} eliminó la venta ${folio}`;
    case 'change_date':
      return `${entry.userEmail} cambió la fecha de la venta ${entry.entityId}`;
    case 'register_payment': {
      const amount = Number(d['monto']);
      const money = Number.isFinite(amount) ? ` de ${formatMoney(amount)}` : '';
      return `${entry.userEmail} registró un pago${money} en la venta ${entry.entityId}`;
    }
    case 'delete_patient':
      return `${entry.userEmail} eliminó un paciente`;
    case 'archive_patient':
      return `${entry.userEmail} archivó un paciente`;
    case 'restore_patient':
      return `${entry.userEmail} restauró un paciente`;
    default:
      return `${entry.userEmail} · ${entry.action}`;
  }
}
