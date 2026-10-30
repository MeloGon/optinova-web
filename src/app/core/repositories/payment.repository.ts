import { AppError } from '../errors/app-error';
import { Payment } from '../models/payment';
import { Result } from '../result';

export type NewPayment = Omit<Payment, 'id' | 'registeredBy'>;

/** Contrato de abonos (= PaymentRepository abstracto de Flutter, recortado al alcance de E2.5). */
export abstract class PaymentRepository {
  /** Abonos de una venta, del más antiguo al más reciente (igual orden que Flutter). */
  abstract listBySale(saleId: string): Promise<Result<Payment[], AppError>>;

  abstract create(payment: NewPayment, registeredById: string): Promise<Result<Payment, AppError>>;
}
