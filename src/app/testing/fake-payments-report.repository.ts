import { AppError } from '../core/errors/app-error';
import { Expense } from '../core/models/expense';
import { PaymentReportEntry, PaymentsReportData, PaymentsReportRepository, PaymentsReportSearch } from '../core/repositories/payments-report.repository';
import { Result, err, ok } from '../core/result';

/** PaymentsReportRepository en memoria para tests: filtra en memoria como lo hace `payments_report`. */
export class FakePaymentsReportRepository extends PaymentsReportRepository {
  payments: PaymentReportEntry[] = [];
  expenses: Expense[] = [];
  failWith: AppError | null = null;
  calls: PaymentsReportSearch[] = [];

  async load(search: PaymentsReportSearch): Promise<Result<PaymentsReportData, AppError>> {
    this.calls.push(search);
    if (this.failWith) return err(this.failWith);

    const { from, to, branch } = search;
    return ok({
      payments: this.payments.filter((p) => p.date >= from && p.date <= to && (!branch || p.branch === branch)),
      expenses: this.expenses.filter((e) => e.date >= from && e.date <= to && (!branch || e.branch === branch)),
    });
  }
}
