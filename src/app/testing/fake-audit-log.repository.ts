import { AppError } from '../core/errors/app-error';
import { AuditLog, AuditLogStats } from '../core/models/audit-log';
import { Page } from '../core/models/page';
import { AuditLogRepository, AuditLogSearch, NewAuditLog } from '../core/repositories/audit-log.repository';
import { Result, err, ok } from '../core/result';

export const fakeAuditLog = (id: string, action = 'create_mount'): AuditLog => ({
  id,
  action,
  entity: 'mount',
  entityId: '1',
  userEmail: 'admin@optinova.test',
  detail: {},
  createdAt: '2026-11-01T10:00:00.000Z',
});

/** AuditLogRepository en memoria para tests: `log()` también queda en `entries`, para los specs de Auditoría. */
export class FakeAuditLogRepository extends AuditLogRepository {
  entries: AuditLog[] = [];
  logged: { entry: NewAuditLog; userEmail: string }[] = [];
  failWith: AppError | null = null;
  searchFailWith: AppError | null = null;
  statsFailWith: AppError | null = null;
  private nextId = 1000;

  async log(entry: NewAuditLog, userEmail: string): Promise<Result<void, AppError>> {
    this.logged.push({ entry, userEmail });
    if (this.failWith) return err(this.failWith);
    this.entries = [
      {
        id: `log-${this.nextId++}`,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        userEmail,
        detail: entry.detail,
        createdAt: new Date().toISOString(),
      },
      ...this.entries,
    ];
    return ok(undefined);
  }

  async search({ query, page, pageSize }: AuditLogSearch): Promise<Result<Page<AuditLog>, AppError>> {
    if (this.searchFailWith) return err(this.searchFailWith);
    const text = query.trim().toLowerCase();
    const matches = this.entries.filter(
      (e) =>
        !text ||
        e.action.toLowerCase().includes(text) ||
        e.entity.toLowerCase().includes(text) ||
        e.entityId.toLowerCase().includes(text) ||
        e.userEmail.toLowerCase().includes(text),
    );
    const from = (page - 1) * pageSize;
    return ok({ items: matches.slice(from, from + pageSize), total: matches.length });
  }

  async stats(): Promise<Result<AuditLogStats, AppError>> {
    if (this.statsFailWith) return err(this.statsFailWith);
    const dates = this.entries.map((e) => e.createdAt).sort();
    return ok({ total: this.entries.length, oldest: dates[0] ?? null, pendingCleanup: 0 });
  }
}
