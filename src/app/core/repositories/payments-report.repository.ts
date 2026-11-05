import { AppError } from '../errors/app-error';
import { Expense } from '../models/expense';
import { Payment } from '../models/payment';
import { Result } from '../result';

export interface PaymentsReportSearch {
  /** `yyyy-MM-dd`, ambas incluidas. */
  from: string;
  to: string;
  /** Solo lo que admin/megadmin pueden elegir; el servidor lo ignora si el rol es supervisor. */
  branch: string | null;
}

/** Un pago con los datos de su venta embebidos, para el reporte de ingresos y egresos. */
export interface PaymentReportEntry extends Payment {
  patientName: string;
  folio: string;
  branch: string;
  saleTotal: number;
  saleRest: number;
}

export interface PaymentsReportData {
  payments: PaymentReportEntry[];
  expenses: Expense[];
}

/**
 * Contrato del reporte de Ingresos y egresos (E2.8): una sola llamada a `payments_report`
 * (`SECURITY DEFINER`, mismo molde que `dashboard_summary`), que decide el alcance por rol y
 * sucursal **en el servidor**, leyendo `perfiles` con `auth.uid()`. Antes `PaymentRepository` y
 * `ExpenseRepository` tenían un `listByDateRange` cada uno que solo filtraban sucursal en el
 * cliente — un supervisor con las herramientas de desarrollador del navegador podía pedir
 * directo a la API los montos de otra sucursal. Hallazgo del dueño/Codex, 2026-11-05.
 */
export abstract class PaymentsReportRepository {
  abstract load(search: PaymentsReportSearch): Promise<Result<PaymentsReportData, AppError>>;
}
