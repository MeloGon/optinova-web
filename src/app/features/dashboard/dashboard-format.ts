import { ActivityEntry, DashboardScope } from '../../core/models/dashboard';

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
