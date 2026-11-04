import { AppError } from '../errors/app-error';
import { Payment } from '../models/payment';
import { Result } from '../result';

export type NewPayment = Omit<Payment, 'id' | 'registeredBy'>;

export interface PaymentDateRangeSearch {
  /** `yyyy-MM-dd`, ambas incluidas. */
  from: string;
  to: string;
  branch: string | null;
}

/** Un pago con los datos de su venta embebidos, para el reporte de ingresos y egresos (E2.8). */
export interface PaymentReportEntry extends Payment {
  patientName: string;
  folio: string;
  branch: string;
  saleTotal: number;
  saleRest: number;
}

/** Contrato de abonos (= PaymentRepository abstracto de Flutter, recortado al alcance de E2.5). */
export abstract class PaymentRepository {
  /** Abonos de una venta, del más antiguo al más reciente (igual orden que Flutter). */
  abstract listBySale(saleId: string): Promise<Result<Payment[], AppError>>;

  /** Abonos de todas las ventas de un paciente, del más reciente al más antiguo (= la ficha, S-03). */
  abstract listByPatient(patientId: string): Promise<Result<Payment[], AppError>>;

  /** Todos los pagos de un período (sin paginar: es un reporte, igual criterio que `SaleRepository.listByMonth`). */
  abstract listByDateRange(params: PaymentDateRangeSearch): Promise<Result<PaymentReportEntry[], AppError>>;

  abstract create(payment: NewPayment, registeredById: string): Promise<Result<Payment, AppError>>;
}
