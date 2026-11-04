import { AppError } from '../errors/app-error';
import { AuditLog, AuditLogStats } from '../models/audit-log';
import { Page } from '../models/page';
import { Result } from '../result';

export interface NewAuditLog {
  action: string;
  entity: string;
  entityId: string;
  detail: Record<string, unknown>;
}

export interface AuditLogSearch {
  /** Busca en acción, entidad, ID de la entidad y correo de quien hizo el cambio. */
  query: string;
  /** Empieza en 1. */
  page: number;
  pageSize: number;
}

/**
 * Contrato de auditoría (= `auditLogRepositoryProvider` de Flutter, con `search`/`stats` nuevos
 * para la pantalla de Settings · Auditoría, que Flutter no tenía). `log` está pensado para
 * "best-effort" (quien llama no debe bloquear la operación si el log falla). La política RLS de
 * `audit_logs` ya deja `INSERT` a cualquier `authenticated` (ver `docs/db-changes.md`), así que se
 * escribe directo desde el cliente, sin Edge Function, igual que Flutter.
 */
export abstract class AuditLogRepository {
  abstract log(entry: NewAuditLog, userEmail: string): Promise<Result<void, AppError>>;

  /** Del más reciente al más antiguo. */
  abstract search(params: AuditLogSearch): Promise<Result<Page<AuditLog>, AppError>>;

  /** = `audit_logs_stats()`: para mostrar cuánto crece la tabla y qué limpiará el cron del cambio #17. */
  abstract stats(): Promise<Result<AuditLogStats, AppError>>;
}
