import { Injectable, inject } from '@angular/core';
import { AppError, toAppError } from '../errors/app-error';
import { Expense } from '../models/expense';
import { PaymentReportEntry, PaymentsReportData, PaymentsReportRepository, PaymentsReportSearch } from '../repositories/payments-report.repository';
import { Result, err, ok } from '../result';
import { SUPABASE } from '../supabase/supabase.client';

interface PaymentRow {
  id: number;
  sale_id: string;
  amount: number;
  date: string;
  payment_method: string | null;
  notes: string | null;
  type: string | null;
  registered_by: string | null;
  patient_name: string | null;
  folio: string | null;
  branch: string | null;
  sale_total: number | null;
  sale_rest: number | null;
}

interface ExpenseRow {
  id: string;
  date: string;
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
  description: string;
  amount: number;
  payment_method: string;
  receipt: string | null;
  branch: string | null;
  registered_by: string | null;
  notes: string | null;
}

interface ReportPayload {
  branch: string | null;
  payments: PaymentRow[];
  expenses: ExpenseRow[];
}

function toPaymentEntry(row: PaymentRow): PaymentReportEntry {
  return {
    id: row.id,
    saleId: row.sale_id,
    amount: Number(row.amount),
    date: row.date,
    paymentMethod: row.payment_method ?? '',
    registeredBy: row.registered_by ?? '',
    notes: row.notes ?? '',
    type: row.type === 'nueva_venta' ? 'nueva_venta' : 'abono_saldo',
    patientName: row.patient_name ?? '',
    folio: row.folio ?? '',
    branch: row.branch ?? '',
    saleTotal: Number(row.sale_total ?? 0),
    saleRest: Number(row.sale_rest ?? 0),
  };
}

function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    date: row.date,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryColor: row.category_color,
    description: row.description,
    amount: Number(row.amount),
    paymentMethod: row.payment_method,
    receipt: row.receipt ?? '',
    branch: row.branch ?? '',
    registeredBy: row.registered_by ?? '',
    notes: row.notes ?? '',
  };
}

@Injectable()
export class SupabasePaymentsReportRepository extends PaymentsReportRepository {
  private readonly supabase = inject(SUPABASE);

  async load({ from, to, branch }: PaymentsReportSearch): Promise<Result<PaymentsReportData, AppError>> {
    const { data, error } = await this.supabase.rpc('payments_report', { p_from: from, p_to: to, p_branch: branch });
    if (error) return err(toAppError(error));

    const payload = data as ReportPayload;
    return ok({
      payments: payload.payments.map(toPaymentEntry),
      expenses: payload.expenses.map(toExpense),
    });
  }
}
