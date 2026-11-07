import { Injectable, inject } from '@angular/core';
import { AppError } from '../errors/app-error';
import { NewPayment, PaymentRepository } from '../repositories/payment.repository';
import { Result } from '../result';

/**
 * Registrar un abono sobre una venta. Lo usan Historial de ventas, la ficha del paciente, el
 * Dashboard y Ventas por vendedor: una sola puerta para las cuatro pantallas.
 *
 * Es atómico: el abono y el nuevo saldo se guardan en una sola transacción en la base
 * (`register_payment`), con la venta bloqueada. Si algo falla no queda un abono sin saldo
 * actualizado ni al revés (en Flutter eran dos pasos sueltos). Un abono mayor al saldo pendiente
 * se rechaza en el servidor.
 */
@Injectable({ providedIn: 'root' })
export class SalePaymentService {
  private readonly paymentRepo = inject(PaymentRepository);

  register(payment: NewPayment): Promise<Result<void, AppError>> {
    return this.paymentRepo.register(payment);
  }
}
