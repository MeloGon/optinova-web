import { AppError } from '../core/errors/app-error';
import { ActivityEntry, DashboardSummary } from '../core/models/dashboard';
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

/** Resumen como lo recibe un vendedor: sin ingresos, métodos de pago ni egresos. */
export const fakeSellerSummary = (): DashboardSummary => ({
  role: 'vendedor',
  scope: 'mine',
  branch: 'MEDILENT',
  today: '2026-11-02',
  kpis: { mySalesTodayCount: 1, mySalesTodayTotal: 500, receivable: 120, patients: 36, incomeToday: null },
  salesByDay: emptyWeek(),
  paymentMethodsToday: null,
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
  kpis: { mySalesTodayCount: 0, mySalesTodayTotal: 0, receivable: 118259, patients: 62, incomeToday: 3200 },
  salesByDay: emptyWeek().map((d, i) => ({ ...d, count: i, total: i * 100 })),
  paymentMethodsToday: [
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

  summaryCalls: (string | null)[] = [];
  activityCalls = 0;

  async summary(branch: string | null): Promise<Result<DashboardSummary, AppError>> {
    this.summaryCalls.push(branch);
    return this.summaryResult;
  }

  async activity(): Promise<Result<ActivityEntry[], AppError>> {
    this.activityCalls++;
    return this.activityResult;
  }
}

export const failWith = (message: string): Result<never, AppError> => err({ kind: 'server', message });
