import { Injectable, inject } from '@angular/core';
import { ConfigService } from '../config/config.service';
import { AppError, toAppError } from '../errors/app-error';
import {
  ActivityEntry,
  CollectionBucketKey,
  DashboardDebt,
  DashboardPeriod,
  DashboardScope,
  DashboardSummary,
  KpiTrend,
  RankedProduct,
} from '../models/dashboard';
import { Role } from '../models/role';
import { DashboardRepository } from '../repositories/dashboard.repository';
import { Result, err, ok } from '../result';
import { SUPABASE } from '../supabase/supabase.client';

/** `{ total, previous_total, series }` de un indicador, tal como lo arma la función SQL. */
interface TrendRow {
  total: number;
  previous_total: number;
  series: { date: string; total: number }[] | null;
}

const toTrend = (row: TrendRow): KpiTrend => ({
  total: Number(row.total),
  previousTotal: Number(row.previous_total),
  series: (row.series ?? []).map((p) => ({ date: p.date, total: Number(p.total) })),
});

interface RankedRow {
  name: string | null;
  units: number;
  total: number;
}

const toRanked = (row: RankedRow): RankedProduct => ({
  name: row.name ?? '',
  units: Number(row.units),
  total: Number(row.total),
});

/** Una venta con saldo dentro de `collections.top`: las columnas de `Sale` más su antigüedad. */
interface DebtRow {
  id: string;
  folio: string;
  date: string | null;
  branch: string | null;
  patient_id: string | null;
  patient: string | null;
  seller: string | null;
  total: number | null;
  discount: number | null;
  total_with_discount: number | null;
  account: number | null;
  rest: number | null;
  age_days: number | null;
}

const toDebt = (row: DebtRow): DashboardDebt => ({
  sale: {
    id: row.id,
    folio: row.folio,
    branch: row.branch ?? '',
    date: row.date ?? '',
    patientName: row.patient ?? '',
    patientId: row.patient_id,
    sellerName: row.seller ?? '',
    total: Number(row.total ?? 0),
    discount: Number(row.discount ?? 0),
    totalWithDiscount: Number(row.total_with_discount ?? 0),
    account: Number(row.account ?? 0),
    rest: Number(row.rest ?? 0),
  },
  days: row.age_days === null ? null : Number(row.age_days),
});

/** JSON de `dashboard_summary()`, tal como lo arma la función SQL. */
interface SummaryRow {
  role: Role;
  scope: DashboardScope;
  branch: string | null;
  today: string;
  period: DashboardPeriod;
  kpis: {
    my_sales: TrendRow & { count: number };
    income: TrendRow | null;
    receivable: number;
    patients: number;
  };
  collections: {
    total: number;
    count: number;
    buckets: { key: CollectionBucketKey; count: number; total: number }[];
    top: DebtRow[];
  };
  low_stock: {
    count: number;
    out_count: number;
    items: {
      id: string;
      brand: string | null;
      model: string | null;
      color: string | null;
      description: string | null;
      code: string | null;
      branch: string | null;
      stock: number;
      price: number | null;
    }[];
  };
  top_products: { brands: RankedRow[]; models: RankedRow[] };
  seller_ranking: { name: string; count: number; total: number }[] | null;
  sales_by_day: { date: string; count: number; total: number }[] | null;
  payment_methods: { method: string; total: number }[] | null;
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
    period: row.period,
    kpis: {
      mySales: { ...toTrend(row.kpis.my_sales), count: Number(row.kpis.my_sales.count) },
      income: row.kpis.income === null ? null : toTrend(row.kpis.income),
      receivable: Number(row.kpis.receivable),
      patients: Number(row.kpis.patients),
    },
    collections: {
      total: Number(row.collections.total),
      count: Number(row.collections.count),
      buckets: row.collections.buckets.map((b) => ({ key: b.key, count: Number(b.count), total: Number(b.total) })),
      top: row.collections.top.map(toDebt),
    },
    lowStock: {
      count: Number(row.low_stock.count),
      outCount: Number(row.low_stock.out_count),
      items: row.low_stock.items.map((m) => ({
        id: m.id,
        brand: m.brand ?? '',
        model: m.model ?? '',
        color: m.color ?? '',
        description: m.description ?? '',
        code: m.code ?? '',
        branch: m.branch ?? '',
        stock: Number(m.stock),
        price: Number(m.price ?? 0),
      })),
    },
    topProducts: {
      brands: row.top_products.brands.map(toRanked),
      models: row.top_products.models.map(toRanked),
    },
    sellerRanking:
      row.seller_ranking?.map((s) => ({ name: s.name, count: Number(s.count), total: Number(s.total) })) ?? null,
    salesByDay: (row.sales_by_day ?? []).map((d) => ({
      date: d.date,
      count: Number(d.count),
      total: Number(d.total),
    })),
    paymentMethods: row.payment_methods?.map((m) => ({
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

  async summary(branch: string | null, period: DashboardPeriod): Promise<Result<DashboardSummary, AppError>> {
    // `p_tz`: "hoy" y los periodos se cuentan en la hora de la empresa, no en UTC.
    const { data, error } = await this.supabase.rpc('dashboard_summary', {
      p_branch: branch,
      p_tz: this.config().timeZone,
      p_period: period,
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
