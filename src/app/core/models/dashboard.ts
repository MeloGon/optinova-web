import { Role } from './role';

/** Alcance con el que el servidor armó el resumen: lo decide el rol, no el cliente. */
export type DashboardScope = 'mine' | 'branch' | 'all';

/** Ventana de tiempo del resumen: hoy, últimos 7 días o el mes en curso. */
export type DashboardPeriod = 'today' | 'week' | 'month';

export interface SeriesPoint {
  /** `yyyy-MM-dd`. */
  date: string;
  total: number;
}

/** Un indicador del periodo con su comparación y su tendencia (mini gráfica). */
export interface KpiTrend {
  total: number;
  /** Lo mismo en el periodo anterior de igual largo (ayer, 7 días previos, mes anterior). */
  previousTotal: number;
  /** Un punto por día, del más antiguo a hoy. */
  series: SeriesPoint[];
}

export interface DashboardSale {
  id: string;
  folio: string;
  /** `yyyy-MM-dd`; null si la venta no tiene fecha. */
  date: string | null;
  patient: string;
  seller: string;
  total: number;
  /** Saldo por cobrar; 0 = pagada. */
  rest: number;
}

export interface DashboardDay {
  /** `yyyy-MM-dd`. */
  date: string;
  count: number;
  total: number;
}

export interface DashboardPaymentMethod {
  method: string;
  total: number;
}

export interface DashboardExpenseCategory {
  category: string;
  /** Color de la categoría (`#RRGGBB`). */
  color: string;
  total: number;
}

/**
 * Resumen del dashboard (= DashboardState de Flutter, pero ya filtrado por rol en la DB).
 * Un campo en `null` significa "este rol no lo puede ver": la tarjeta no se dibuja.
 */
export interface DashboardSummary {
  role: Role;
  scope: DashboardScope;
  /** Sucursal efectiva del resumen; null = toda la empresa. */
  branch: string | null;
  /** Hoy según la zona horaria de la empresa, `yyyy-MM-dd`. */
  today: string;
  /** Periodo con el que el servidor armó el resumen. */
  period: DashboardPeriod;
  kpis: {
    /**
     * Ventas del periodo que quedaron a nombre del usuario (no cuenta las que salieron de su
     * cuenta a nombre de otro).
     */
    mySales: KpiTrend & { count: number };
    /** Cobrado en el periodo; null para roles que no ven dinero de la empresa. */
    income: KpiTrend | null;
    /** Saldo pendiente de las ventas visibles: es una foto de hoy, no depende del periodo. */
    receivable: number;
    patients: number;
  };
  /** Un punto por día: los últimos 7 (periodos hoy y 7 días) o el mes en curso. */
  salesByDay: DashboardDay[];
  /** Métodos de pago del periodo; null para roles que no ven ingresos. */
  paymentMethods: DashboardPaymentMethod[] | null;
  expensesMonth: DashboardExpenseCategory[] | null;
  recentSales: DashboardSale[];
}

/** Una línea de la auditoría (`audit_logs`). Solo admin o superior. */
export interface ActivityEntry {
  action: string;
  entity: string;
  entityId: string;
  userEmail: string;
  detail: Record<string, unknown>;
  /** ISO 8601. */
  createdAt: string;
}
