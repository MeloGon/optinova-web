import { Injectable, inject } from '@angular/core';
import { ConfigService } from '../config/config.service';
import { AppError, toAppError } from '../errors/app-error';
import { ActivityEntry, DashboardScope, DashboardSummary } from '../models/dashboard';
import { Role } from '../models/role';
import { DashboardRepository } from '../repositories/dashboard.repository';
import { Result, err, ok } from '../result';
import { SUPABASE } from '../supabase/supabase.client';

/** JSON de `dashboard_summary()`, tal como lo arma la función SQL. */
interface SummaryRow {
  role: Role;
  scope: DashboardScope;
  branch: string | null;
  today: string;
  kpis: {
    my_sales_today_count: number;
    my_sales_today_total: number;
    receivable: number;
    patients: number;
    income_today: number | null;
  };
  sales_by_day: { date: string; count: number; total: number }[] | null;
  payment_methods_today: { method: string; total: number }[] | null;
  expenses_month: { category: string; color: string; total: number }[] | null;
  recent_sales: {
    id: string;
    folio: string;
    fecha: string | null;
    patient: string | null;
    seller: string | null;
    total: number | null;
    rest: number | null;
  }[];
}

interface ActivityRow {
  action: string;
  entity: string;
  entity_id: string;
  user_email: string;
  detail: Record<string, unknown> | null;
  created_at: string;
}

function toSummary(row: SummaryRow): DashboardSummary {
  return {
    role: row.role,
    scope: row.scope,
    branch: row.branch,
    today: row.today,
    kpis: {
      mySalesTodayCount: Number(row.kpis.my_sales_today_count),
      mySalesTodayTotal: Number(row.kpis.my_sales_today_total),
      receivable: Number(row.kpis.receivable),
      patients: Number(row.kpis.patients),
      incomeToday: row.kpis.income_today === null ? null : Number(row.kpis.income_today),
    },
    salesByDay: (row.sales_by_day ?? []).map((d) => ({
      date: d.date,
      count: Number(d.count),
      total: Number(d.total),
    })),
    paymentMethodsToday: row.payment_methods_today?.map((m) => ({
      method: m.method,
      total: Number(m.total),
    })) ?? null,
    expensesMonth: row.expenses_month?.map((c) => ({
      category: c.category,
      color: c.color,
      total: Number(c.total),
    })) ?? null,
    recentSales: row.recent_sales.map((s) => ({
      id: s.id,
      folio: s.folio,
      date: s.fecha,
      patient: s.patient ?? '',
      seller: s.seller ?? '',
      total: Number(s.total ?? 0),
      rest: Number(s.rest ?? 0),
    })),
  };
}

@Injectable()
export class SupabaseDashboardRepository extends DashboardRepository {
  private readonly supabase = inject(SUPABASE);
  private readonly config = inject(ConfigService).config;

  async summary(branch: string | null): Promise<Result<DashboardSummary, AppError>> {
    // `p_tz`: "hoy" y los 7 días se cuentan en la hora de la empresa, no en UTC.
    const { data, error } = await this.supabase.rpc('dashboard_summary', {
      p_branch: branch,
      p_tz: this.config().timeZone,
    });
    if (error) return err(toAppError(error));
    return ok(toSummary(data as SummaryRow));
  }

  async activity(limit: number): Promise<Result<ActivityEntry[], AppError>> {
    const { data, error } = await this.supabase.rpc('dashboard_activity', { p_limit: limit });
    if (error) return err(toAppError(error));
    return ok(
      (data as ActivityRow[]).map((a) => ({
        action: a.action,
        entity: a.entity,
        entityId: a.entity_id,
        userEmail: a.user_email,
        detail: a.detail ?? {},
        createdAt: a.created_at,
      })),
    );
  }
}
