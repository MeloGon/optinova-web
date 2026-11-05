import { AppError, appError } from '../core/errors/app-error';
import { AppFeature } from '../core/models/app-feature';
import { AppConfigRepository } from '../core/repositories/app-config.repository';
import { Result, err, ok } from '../core/result';

export const fakeFeature = (key: string, value = true, description = ''): AppFeature => ({ key, value, description });

/** AppConfigRepository en memoria para tests. */
export class FakeAppConfigRepository extends AppConfigRepository {
  features: AppFeature[] = [];
  listFailWith: AppError | null = null;
  /** Simula la RLS del cambio #21: si es false, `setValue` no cambia nada (como si fuera otro rol). */
  canWrite = true;
  setValueFailWith: AppError | null = null;

  async list(): Promise<Result<AppFeature[], AppError>> {
    if (this.listFailWith) return err(this.listFailWith);
    return ok(this.features);
  }

  async setValue(key: string, value: boolean): Promise<Result<void, AppError>> {
    if (this.setValueFailWith) return err(this.setValueFailWith);
    if (!this.canWrite) return err(appError('unauthorized', 'No tienes permiso para cambiar esta función.'));
    this.features = this.features.map((f) => (f.key === key ? { ...f, value } : f));
    return ok(undefined);
  }
}
