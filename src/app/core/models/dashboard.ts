import { Role } from './role';

/** Alcance con el que el servidor armó el resumen: lo decide el rol, no el cliente. */
export type DashboardScope = 'mine' | 'branch' | 'all';

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
  kpis: {
    /** Ventas de hoy que quedaron a nombre del usuario (no cuenta las que salieron de su cuenta a nombre de otro). */
    mySalesTodayCount: number;
    mySalesTodayTotal: number;
    receivable: number;
    patients: number;
    incomeToday: number | null;
  };
  /** Siempre 7 días, del más antiguo a hoy. */
  salesByDay: DashboardDay[];
  paymentMethodsToday: DashboardPaymentMethod[] | null;
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
