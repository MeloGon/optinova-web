/** Abono a una venta (= PaymentModel de Flutter; tabla `pagos`). */
export interface Payment {
  id: number;
  saleId: string;
  amount: number;
  /** `yyyy-MM-dd`. */
  date: string;
  paymentMethod: string;
  /** Nombre de quien lo registró (join a `perfiles`); vacío si no se pudo resolver. */
  registeredBy: string;
  notes: string;
}
