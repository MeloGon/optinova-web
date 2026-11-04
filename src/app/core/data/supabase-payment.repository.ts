import { Injectable, inject } from '@angular/core';
import { AppError, toAppError } from '../errors/app-error';
import { Payment } from '../models/payment';
import { NewPayment, PaymentDateRangeSearch, PaymentReportEntry, PaymentRepository } from '../repositories/payment.repository';
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
  tipo_pago: string | null;
  perfiles: { nombre: string } | null;
}

/** Fila con la venta embebida, para el reporte de ingresos y egresos. */
interface PaymentReportRow extends PaymentRow {
  ventas: { paciente_nombre: string | null; folio: string | null; sucursal: string | null; total_con_descuento: number | null; resta: number | null };
}

const COLUMNS = 'id, id_remision, monto, fecha_pago, metodo_pago, notas, tipo_pago, perfiles(nombre)';
const REPORT_COLUMNS = `${COLUMNS}, ventas!inner(paciente_nombre, folio, sucursal, total_con_descuento, resta)`;

function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    saleId: row.id_remision,
    amount: Number(row.monto),
    date: row.fecha_pago,
    paymentMethod: row.metodo_pago ?? '',
    registeredBy: row.perfiles?.nombre ?? '',
    notes: row.notas ?? '',
    type: row.tipo_pago === 'nueva_venta' ? 'nueva_venta' : 'abono_saldo',
  };
}

function toReportEntry(row: PaymentReportRow): PaymentReportEntry {
  return {
    ...toPayment(row),
    patientName: row.ventas.paciente_nombre ?? '',
    folio: row.ventas.folio ?? '',
    branch: row.ventas.sucursal ?? '',
    saleTotal: Number(row.ventas.total_con_descuento ?? 0),
    saleRest: Number(row.ventas.resta ?? 0),
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

  /**
   * `pagos.id_remision` sí tiene FK real a `ventas.id` (`pagos_id_remision_fkey`): se puede
   * filtrar por el `paciente_id` de la venta embebiendo la relación, mismo truco que ya usa
   * `perfiles(nombre)` arriba. `!inner` hace falta para que el filtro de la tabla embebida
   * (`.eq('ventas.paciente_id', ...)`) de verdad filtre en vez de solo adjuntar el dato.
   */
  async listByPatient(patientId: string): Promise<Result<Payment[], AppError>> {
    const { data, error } = await this.supabase
      .from('pagos')
      .select(`${COLUMNS}, ventas!inner(paciente_id)`)
      .eq('ventas.paciente_id', patientId)
      .order('fecha_pago', { ascending: false })
      .order('id', { ascending: false })
      .overrideTypes<PaymentRow[], { merge: false }>();

    if (error) return err(toAppError(error));
    return ok(data.map(toPayment));
  }

  async listByDateRange({ from, to, branch }: PaymentDateRangeSearch): Promise<Result<PaymentReportEntry[], AppError>> {
    let request = this.supabase.from('pagos').select(REPORT_COLUMNS).gte('fecha_pago', from).lte('fecha_pago', to);
    if (branch) request = request.eq('ventas.sucursal', branch);

    const { data, error } = await request
      .order('fecha_pago', { ascending: false })
      .overrideTypes<PaymentReportRow[], { merge: false }>();
    if (error) return err(toAppError(error));
    return ok(data.map(toReportEntry));
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
        tipo_pago: payment.type,
        registrado_por: registeredById,
      })
      .select(COLUMNS)
      .single<PaymentRow>();

    if (error) return err(toAppError(error));
    return ok(toPayment(data));
  }
}
