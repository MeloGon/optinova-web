/** Fila de `audit_logs` (acción sobre catálogo, venta, pago o paciente). */
export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  userEmail: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

/** Lo que devuelve `audit_logs_stats()`: para medir el crecimiento y el efecto de la limpieza mensual. */
export interface AuditLogStats {
  total: number;
  /** `null` si la tabla está vacía. */
  oldest: string | null;
  /** Filas que se borrarán en la próxima corrida del cron (más de 3 meses). */
  pendingCleanup: number;
}
