import { Role } from './role';
import { Sale } from './sale';

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

/** Antigüedad de una venta con saldo: 0–7 días, 8–30 o 31 o más. */
export type CollectionBucketKey = 'recent' | 'mid' | 'old';

export interface CollectionBucket {
  key: CollectionBucketKey;
  count: number;
  total: number;
}

/** Una venta con saldo, completa (lo que necesita "Registrar abono"), y cuánto lleva pendiente. */
export interface DashboardDebt {
  sale: Sale;
  /** Días desde la venta; null si no tiene fecha. */
  days: number | null;
}

/** Cobranza: lo que falta cobrar en las ventas visibles. Foto de hoy, no depende del periodo. */
export interface DashboardCollections {
  total: number;
  /** Ventas con saldo. */
  count: number;
  /** Siempre tres, de la más reciente a la más antigua. */
  buckets: CollectionBucket[];
  /** Las ventas con mayor saldo (hasta 5). */
  top: DashboardDebt[];
}

/** Un armazón con pocas unidades (1 o 2). */
export interface LowStockItem {
  id: string;
  brand: string;
  model: string;
  color: string;
  /** Descripción libre; sirve de nombre cuando el armazón no tiene marca ni modelo. */
  description: string;
  /** Código de barras. */
  code: string;
  branch: string;
  stock: number;
  price: number;
}

/**
 * Armazones por reponer, del inventario de la sucursal del usuario (admin: de toda la empresa).
 * `items` lista solo los que tienen 1 o 2 unidades; los agotados (0) solo se cuentan: muchos
 * modelos en 0 están descontinuados y llenarían la lista de ruido.
 */
export interface DashboardLowStock {
  /** Armazones con 1 o 2 unidades (puede ser más que `items.length`, que se corta). */
  count: number;
  /** Armazones agotados. */
  outCount: number;
  items: LowStockItem[];
}

/** Una marca o un armazón en el top de ventas: unidades vendidas e importe. */
export interface RankedProduct {
  name: string;
  units: number;
  total: number;
}

/** Lo más vendido del mes en armazones, de las ventas que ve el usuario (hasta 5 de cada uno). */
export interface DashboardTopProducts {
  brands: RankedProduct[];
  /** Un armazón es marca + modelo. */
  models: RankedProduct[];
}

/** Un vendedor en el ranking del mes: ventas e importe a su nombre. */
export interface SellerRank {
  name: string;
  count: number;
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
  collections: DashboardCollections;
  lowStock: DashboardLowStock;
  /** Del mes en curso, sea cual sea el periodo elegido. */
  topProducts: DashboardTopProducts;
  /** Ranking del mes; null para el vendedor (ve lo suyo en "Mis ventas" con periodo Mes). */
  sellerRanking: SellerRank[] | null;
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
