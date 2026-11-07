import { AppError, appError } from '../core/errors/app-error';
import { Payment } from '../core/models/payment';
import { Sale } from '../core/models/sale';
import { NewPayment, PaymentRepository } from '../core/repositories/payment.repository';
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

  registered: NewPayment[] = [];
  registerFailWith: AppError | null = null;
  private nextId = 1000;

  async listBySale(saleId: string): Promise<Result<Payment[], AppError>> {
    return ok(this.payments.filter((p) => p.saleId === saleId));
  }

  async listByPatient(patientId: string): Promise<Result<Payment[], AppError>> {
    const saleIds = (this.saleRepo?.sales ?? []).filter((s) => s.patientId === patientId).map((s) => s.id);
    return ok(this.payments.filter((p) => saleIds.includes(p.saleId)));
  }

  /**
   * Imita `register_payment`: si conoce la venta, rechaza un abono mayor al saldo y deja la venta
   * con su nuevo abonado y saldo; si falla, no guarda nada (es una sola transacción).
   */
  async register(payment: NewPayment): Promise<Result<void, AppError>> {
    if (this.registerFailWith) return err(this.registerFailWith);

    const sales = this.saleRepo?.sales;
    if (this.saleRepo && sales) {
      const sale = sales.find((s) => s.id === payment.saleId);
      if (sale) {
        if (payment.amount > sale.rest) {
          return err(appError('server', `El abono (${payment.amount}) supera el saldo pendiente (${sale.rest}).`));
        }
        this.saleRepo.sales = sales.map((s) =>
          s.id === sale.id
            ? { ...s, account: s.account + payment.amount, rest: Math.max(s.rest - payment.amount, 0), date: payment.date }
            : s,
        );
      }
    }

    this.registered.push(payment);
    this.payments = [...this.payments, { ...payment, id: this.nextId++, registeredBy: 'Vendedor Prueba' }];
    return ok(undefined);
  }
}
