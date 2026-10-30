import { Injectable, inject } from '@angular/core';
import { AppError, toAppError } from '../errors/app-error';
import { Payment } from '../models/payment';
import { NewPayment, PaymentRepository } from '../repositories/payment.repository';
import { Result, err, ok } from '../result';
import { SUPABASE } from '../supabase/supabase.client';

/** Fila de `pagos` con el nombre de quien lo registró, tal como viene de la DB. */
interface PaymentRow {
  id: number;
  id_remision: string;
  monto: number;
  fecha_pago: string;
  metodo_pago: string | null;
  notas: string | null;
  perfiles: { nombre: string } | null;
}

const COLUMNS = 'id, id_remision, monto, fecha_pago, metodo_pago, notas, perfiles(nombre)';

function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    saleId: row.id_remision,
    amount: Number(row.monto),
    date: row.fecha_pago,
    paymentMethod: row.metodo_pago ?? '',
    registeredBy: row.perfiles?.nombre ?? '',
    notes: row.notas ?? '',
  };
}

@Injectable()
export class SupabasePaymentRepository extends PaymentRepository {
  private readonly supabase = inject(SUPABASE);

  async listBySale(saleId: string): Promise<Result<Payment[], AppError>> {
    const { data, error } = await this.supabase
      .from('pagos')
      .select(COLUMNS)
      .eq('id_remision', saleId)
      .order('fecha_pago', { ascending: true })
      .order('id', { ascending: true })
      .overrideTypes<PaymentRow[], { merge: false }>();

    if (error) return err(toAppError(error));
    return ok(data.map(toPayment));
  }

  async create(payment: NewPayment, registeredById: string): Promise<Result<Payment, AppError>> {
    const { data, error } = await this.supabase
      .from('pagos')
      .insert({
        id_remision: payment.saleId,
        monto: payment.amount,
        fecha_pago: payment.date,
        metodo_pago: payment.paymentMethod,
        notas: payment.notes || null,
        registrado_por: registeredById,
      })
      .select(COLUMNS)
      .single<PaymentRow>();

    if (error) return err(toAppError(error));
    return ok(toPayment(data));
  }
}
