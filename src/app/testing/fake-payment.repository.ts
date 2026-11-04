import { AppError } from '../core/errors/app-error';
import { Payment } from '../core/models/payment';
import { Sale } from '../core/models/sale';
import { NewPayment, PaymentDateRangeSearch, PaymentReportEntry, PaymentRepository } from '../core/repositories/payment.repository';
import { Result, err, ok } from '../core/result';

export const fakePayment = (id: number, saleId: string, amount = 50): Payment => ({
  id,
  saleId,
  amount,
  date: '2026-10-05',
  paymentMethod: 'efectivo',
  registeredBy: 'Vendedor Prueba',
  notes: '',
  type: 'abono_saldo',
});

/** PaymentRepository en memoria para tests. `saleRepo` es opcional: solo lo necesita `listByPatient`. */
export class FakePaymentRepository extends PaymentRepository {
  constructor(private readonly saleRepo?: { sales: Sale[] }) {
    super();
  }

  payments: Payment[] = [];

  created: { payment: NewPayment; registeredById: string }[] = [];
  createFailWith: AppError | null = null;
  listByDateRangeFailWith: AppError | null = null;
  private nextId = 1000;

  async listBySale(saleId: string): Promise<Result<Payment[], AppError>> {
    return ok(this.payments.filter((p) => p.saleId === saleId));
  }

  async listByPatient(patientId: string): Promise<Result<Payment[], AppError>> {
    const saleIds = (this.saleRepo?.sales ?? []).filter((s) => s.patientId === patientId).map((s) => s.id);
    return ok(this.payments.filter((p) => saleIds.includes(p.saleId)));
  }

  async listByDateRange({ from, to, branch }: PaymentDateRangeSearch): Promise<Result<PaymentReportEntry[], AppError>> {
    if (this.listByDateRangeFailWith) return err(this.listByDateRangeFailWith);
    const sales = this.saleRepo?.sales ?? [];
    const entries = this.payments
      .filter((p) => p.date >= from && p.date <= to)
      .map((p): PaymentReportEntry | null => {
        const sale = sales.find((s) => s.id === p.saleId);
        if (!sale) return null;
        if (branch && sale.branch !== branch) return null;
        return {
          ...p,
          patientName: sale.patientName,
          folio: sale.folio,
          branch: sale.branch,
          saleTotal: sale.totalWithDiscount,
          saleRest: sale.rest,
        };
      })
      .filter((e): e is PaymentReportEntry => e !== null);
    return ok(entries);
  }

  async create(payment: NewPayment, registeredById: string): Promise<Result<Payment, AppError>> {
    if (this.createFailWith) return err(this.createFailWith);
    this.created.push({ payment, registeredById });
    const saved: Payment = { ...payment, id: this.nextId++, registeredBy: registeredById };
    this.payments = [...this.payments, saved];
    return ok(saved);
  }
}
