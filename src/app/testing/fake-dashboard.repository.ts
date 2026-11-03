import { AppError } from '../core/errors/app-error';
import {
  ActivityEntry,
  DashboardCollections,
  DashboardLowStock,
  DashboardPeriod,
  DashboardSummary,
  DashboardTopProducts,
  SellerRank,
  SeriesPoint,
} from '../core/models/dashboard';
import { fakeSale } from './fake-sale.repository';
import { DashboardRepository } from '../core/repositories/dashboard.repository';
import { Result, err, ok } from '../core/result';

/** Siete días terminando en `today`, todos en cero. */
export const emptyWeek = (today = '2026-11-02') => {
  const end = new Date(`${today}T00:00:00Z`);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - (6 - i));
    return { date: d.toISOString().slice(0, 10), count: 0, total: 0 };
  });
};

/** Serie de 7 puntos con los totales dados (rellena con 0 si faltan). */
export const fakeSeries = (...totals: number[]): SeriesPoint[] =>
  emptyWeek().map((d, i) => ({ date: d.date, total: totals[i] ?? 0 }));

/** Sin armazones vendidos en el mes. */
export const noTopProducts = (): DashboardTopProducts => ({ brands: [], models: [] });

/** Dos marcas y tres armazones vendidos en el mes. */
export const fakeTopProducts = (): DashboardTopProducts => ({
  brands: [
    { name: 'Ray-Ban', units: 4, total: 6500 },
    { name: 'TOMMY', units: 2, total: 4354 },
  ],
  models: [
    { name: 'Ray-Ban RB5154', units: 3, total: 4500 },
    { name: 'TOMMY MOD-001', units: 2, total: 4354 },
    { name: 'Ray-Ban Clubmaster', units: 1, total: 2000 },
  ],
});

/** Tres vendedores con ventas en el mes, del que más vendió al que menos. */
export const fakeSellerRanking = (): SellerRank[] => [
  { name: 'Vendedor Test', count: 5, total: 8000 },
  { name: 'JORGE DIAZ', count: 1, total: 3161 },
  { name: 'Admin Test', count: 3, total: 2600 },
];

/** Inventario sin armazones por reponer. */
export const noLowStock = (): DashboardLowStock => ({ count: 0, outCount: 0, items: [] });

/** Tres armazones con poco stock (uno con 1 unidad, dos con 2) y cinco agotados. */
export const fakeLowStock = (): DashboardLowStock => ({
  count: 3,
  outCount: 5,
  items: [
    { id: '1', brand: 'OAKLEY', model: 'MOD-014', color: 'NEGRO', description: '', code: '750001', branch: 'OFTALVISION', stock: 1, price: 450 },
    { id: '2', brand: 'CARRERA', model: 'MOD-018', color: 'AZUL', description: '', code: '750002', branch: 'MEDILENT', stock: 2, price: 380 },
    { id: '3', brand: '', model: '', color: '', description: 'ARMAZON GENERICO', code: '', branch: 'MEDILENT', stock: 2, price: 120 },
  ],
});

/** Cobranza sin saldos pendientes. */
export const noCollections = (): DashboardCollections => ({
  total: 0,
  count: 0,
  buckets: [
    { key: 'recent', count: 0, total: 0 },
    { key: 'mid', count: 0, total: 0 },
    { key: 'old', count: 0, total: 0 },
  ],
  top: [],
});

/** Cobranza con tres ventas, una por antigüedad (saldos 100, 250 y 900). */
export const fakeCollections = (): DashboardCollections => ({
  total: 1250,
  count: 3,
  buckets: [
    { key: 'recent', count: 1, total: 100 },
    { key: 'mid', count: 1, total: 250 },
    { key: 'old', count: 1, total: 900 },
  ],
  top: [
    { sale: { ...fakeSale('30', 'LUIS VEGA', '7'), totalWithDiscount: 1500, account: 600, rest: 900 }, days: 45 },
    { sale: { ...fakeSale('31', 'MARTA RIOS'), totalWithDiscount: 400, account: 150, rest: 250 }, days: 12 },
    { sale: { ...fakeSale('32', 'PEDRO SOL'), totalWithDiscount: 200, account: 100, rest: 100 }, days: 0 },
  ],
});

/** Resumen como lo recibe un vendedor: sin ingresos, métodos de pago ni egresos. */
export const fakeSellerSummary = (): DashboardSummary => ({
  role: 'vendedor',
  scope: 'mine',
  branch: 'MEDILENT',
  today: '2026-11-02',
  period: 'today',
  kpis: {
    mySales: { count: 1, total: 500, previousTotal: 400, series: fakeSeries(0, 0, 0, 0, 0, 400, 500) },
    income: null,
    receivable: 120,
    patients: 36,
  },
  collections: noCollections(),
  lowStock: noLowStock(),
  topProducts: noTopProducts(),
  sellerRanking: null,
  salesByDay: emptyWeek(),
  paymentMethods: null,
  expensesMonth: null,
  recentSales: [
    { id: '1', folio: '100058', date: '2026-11-02', patient: 'ANA PRUEBA', seller: 'Vendedor Prueba', total: 500, rest: 120 },
  ],
});

/** Resumen como lo recibe un admin: todo el alcance. */
export const fakeAdminSummary = (): DashboardSummary => ({
  role: 'admin',
  scope: 'all',
  branch: null,
  today: '2026-11-02',
  period: 'today',
  kpis: {
    mySales: { count: 0, total: 0, previousTotal: 0, series: fakeSeries() },
    income: { total: 3200, previousTotal: 2000, series: fakeSeries(0, 100, 0, 0, 500, 2000, 3200) },
    receivable: 118259,
    patients: 62,
  },
  collections: fakeCollections(),
  lowStock: fakeLowStock(),
  topProducts: fakeTopProducts(),
  sellerRanking: fakeSellerRanking(),
  salesByDay: emptyWeek().map((d, i) => ({ ...d, count: i, total: i * 100 })),
  paymentMethods: [
    { method: 'efectivo', total: 2800 },
    { method: 'tarjeta', total: 400 },
  ],
  expensesMonth: [{ category: 'Servicios', color: '#6366F1', total: 900 }],
  recentSales: [],
});

export const fakeActivity = (action = 'create_sale'): ActivityEntry => ({
  action,
  entity: 'sale',
  entityId: '100058',
  userEmail: 'vendedor@optinova.test',
  detail: { vendedor: 'BETO', creado_por_nombre: 'Vendedor Prueba' },
  createdAt: '2026-11-02T15:00:00Z',
});

/** DashboardRepository en memoria para tests. */
export class FakeDashboardRepository extends DashboardRepository {
  summaryResult: Result<DashboardSummary, AppError> = ok(fakeSellerSummary());
  activityResult: Result<ActivityEntry[], AppError> = ok([]);

  /** Cada llamada a `summary`, con la sucursal y el periodo pedidos. */
  summaryCalls: { branch: string | null; period: DashboardPeriod }[] = [];
  activityCalls = 0;

  async summary(branch: string | null, period: DashboardPeriod): Promise<Result<DashboardSummary, AppError>> {
    this.summaryCalls.push({ branch, period });
    return this.summaryResult;
  }

  async activity(): Promise<Result<ActivityEntry[], AppError>> {
    this.activityCalls++;
    return this.activityResult;
  }
}

export const failWith = (message: string): Result<never, AppError> => err({ kind: 'server', message });
