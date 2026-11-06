import { AppError } from '../core/errors/app-error';
import { BranchSetting, BranchSettingsRepository } from '../core/repositories/branch-settings.repository';
import { Result, err, ok } from '../core/result';

/** BranchSettingsRepository en memoria para tests. */
export class FakeBranchSettingsRepository extends BranchSettingsRepository {
  settings: BranchSetting[] = [];
  listFailWith: AppError | null = null;
  setFailWith: AppError | null = null;
  setCalls: { branch: string; value: boolean }[] = [];

  async list(): Promise<Result<BranchSetting[], AppError>> {
    if (this.listFailWith) return err(this.listFailWith);
    return ok(this.settings);
  }

  async setDiscountRequiresAuth(branch: string, value: boolean): Promise<Result<void, AppError>> {
    this.setCalls.push({ branch, value });
    if (this.setFailWith) return err(this.setFailWith);
    const exists = this.settings.some((s) => s.branch === branch);
    this.settings = exists
      ? this.settings.map((s) => (s.branch === branch ? { ...s, discountRequiresAuth: value } : s))
      : [...this.settings, { branch, discountRequiresAuth: value }];
    return ok(undefined);
  }
}
