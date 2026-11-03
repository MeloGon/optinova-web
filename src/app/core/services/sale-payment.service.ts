import { Injectable, inject } from '@angular/core';
import { AppError } from '../errors/app-error';
import { Sale } from '../models/sale';
import { NewPayment, PaymentRepository } from '../repositories/payment.repository';
import { SaleRepository } from '../repositories/sale.repository';
import { Result } from '../result';

/**
 * Registrar un abono sobre una venta (= registerPayment de Flutter: dos pasos, uno por repositorio).
 * Lo usan Historial de ventas, la ficha del paciente y el Dashboard: antes cada store tenía su copia.
 *
 * No es atómico: si el segundo paso falla, el pago ya quedó insertado y no se revierte (es una
 * cuenta por cobrar real, no conviene perder el registro del abono). Misma tolerancia que Flutter;
 * se revisa al pasar a NestJS o a una función SQL.
 */
@Injectable({ providedIn: 'root' })
export class SalePaymentService {
  private readonly paymentRepo = inject(PaymentRepository);
  private readonly saleRepo = inject(SaleRepository);

  async register(sale: Sale, payment: NewPayment, registeredById: string): Promise<Result<void, AppError>> {
    const inserted = await this.paymentRepo.create(payment, registeredById);
    if (!inserted.ok) return inserted;

    const newAccount = sale.account + payment.amount;
    const newRest = Math.max(sale.totalWithDiscount - newAccount, 0);
    return this.saleRepo.applyPayment(sale.id, newAccount, newRest, payment.date);
  }
}
