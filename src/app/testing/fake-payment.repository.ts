import { AppError } from '../core/errors/app-error';
import { Payment } from '../core/models/payment';
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
});

/** PaymentRepository en memoria para tests. */
export class FakePaymentRepository extends PaymentRepository {
  payments: Payment[] = [];

  created: { payment: NewPayment; registeredById: string }[] = [];
  createFailWith: AppError | null = null;
  private nextId = 1000;

  async listBySale(saleId: string): Promise<Result<Payment[], AppError>> {
    return ok(this.payments.filter((p) => p.saleId === saleId));
  }

  async create(payment: NewPayment, registeredById: string): Promise<Result<Payment, AppError>> {
    if (this.createFailWith) return err(this.createFailWith);
    this.created.push({ payment, registeredById });
    const saved: Payment = { ...payment, id: this.nextId++, registeredBy: registeredById };
    this.payments = [...this.payments, saved];
    return ok(saved);
  }
}
