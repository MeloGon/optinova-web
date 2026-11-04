import { Injectable, inject } from '@angular/core';
import { AppError, toAppError } from '../errors/app-error';
import { AuditLog, AuditLogStats } from '../models/audit-log';
import { Page } from '../models/page';
import { AuditLogRepository, AuditLogSearch, NewAuditLog } from '../repositories/audit-log.repository';
import { Result, err, ok } from '../result';
import { escapeLike } from '../supabase/escape-like';
import { SUPABASE } from '../supabase/supabase.client';

interface AuditLogRow {
  id: string;
  action: string;
  entity: string;
  entity_id: string;
  user_email: string;
  detail: Record<string, unknown> | null;
  created_at: string;
}

interface StatsRow {
  total: number;
  oldest: string | null;
  pending_cleanup: number;
}

const COLUMNS = 'id, action, entity, entity_id, user_email, detail, created_at';

function toAuditLog(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id,
    userEmail: row.user_email,
    detail: row.detail ?? {},
    createdAt: row.created_at,
  };
}

@Injectable()
export class SupabaseAuditLogRepository extends AuditLogRepository {
  private readonly supabase = inject(SUPABASE);

  async log(entry: NewAuditLog, userEmail: string): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.from('audit_logs').insert({
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId,
      user_email: userEmail,
      detail: entry.detail,
    });
    if (error) return err(toAppError(error));
    return ok(undefined);
  }

  async search({ query, page, pageSize }: AuditLogSearch): Promise<Result<Page<AuditLog>, AppError>> {
    const text = query.trim();
    const from = (page - 1) * pageSize;

    let request = this.supabase.from('audit_logs').select(COLUMNS, { count: 'exact' });
    if (text) {
      const escaped = escapeLike(text);
      request = request.or(
        `action.ilike.%${escaped}%,entity.ilike.%${escaped}%,entity_id.ilike.%${escaped}%,user_email.ilike.%${escaped}%`,
      );
    }

    const { data, count, error } = await request
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)
      .overrideTypes<AuditLogRow[], { merge: false }>();
    if (error) return err(toAppError(error));
    return ok({ items: data.map(toAuditLog), total: count ?? 0 });
  }

  async stats(): Promise<Result<AuditLogStats, AppError>> {
    const { data, error } = await this.supabase.rpc('audit_logs_stats');
    if (error) return err(toAppError(error));
    const row = (data as StatsRow[])[0];
    return ok({ total: row?.total ?? 0, oldest: row?.oldest ?? null, pendingCleanup: row?.pending_cleanup ?? 0 });
  }
}
