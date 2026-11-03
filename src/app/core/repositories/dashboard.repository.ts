import { AppError } from '../errors/app-error';
import { ActivityEntry, DashboardPeriod, DashboardSummary } from '../models/dashboard';
import { Result } from '../result';

/**
 * Contrato del dashboard. El alcance por rol lo aplica el servidor (funciones SQL
 * `dashboard_summary` / `dashboard_activity`): este contrato no recibe rol ni usuario.
 */
export abstract class DashboardRepository {
  /**
   * `branch` solo lo respeta el servidor para admin o superior (filtro opcional);
   * para los demás roles se ignora. `period` define la ventana y contra qué se compara.
   */
  abstract summary(branch: string | null, period: DashboardPeriod): Promise<Result<DashboardSummary, AppError>>;

  /** Auditoría reciente. El servidor la niega por debajo de admin. */
  abstract activity(limit: number): Promise<Result<ActivityEntry[], AppError>>;
}
