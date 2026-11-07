import { AppError } from '../errors/app-error';
import { Payment } from '../models/payment';
import { Result } from '../result';

export type NewPayment = Omit<Payment, 'id' | 'registeredBy'>;

/** Contrato de abonos (= PaymentRepository abstracto de Flutter, recortado al alcance de E2.5). */
export abstract class PaymentRepository {
  /** Abonos de una venta, del más antiguo al más reciente (igual orden que Flutter). */
  abstract listBySale(saleId: string): Promise<Result<Payment[], AppError>>;

  /** Abonos de todas las ventas de un paciente, del más reciente al más antiguo (= la ficha, S-03). */
  abstract listByPatient(patientId: string): Promise<Result<Payment[], AppError>>;

  /**
   * Registra un abono y actualiza el saldo de la venta en UNA transacción (función
   * `register_payment`, migración #26), con la venta bloqueada para que dos abonos simultáneos
   * no se pisen. Rechaza un abono mayor al saldo pendiente. Quién lo registró lo pone el
   * servidor con la sesión, no el navegador.
   */
  abstract register(payment: NewPayment): Promise<Result<void, AppError>>;
}
