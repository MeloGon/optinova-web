/**
 * Venta/remisión (= SalesModel de Flutter). `id` es el folio interno con el que se enlazan pagos
 * y líneas (antes `"ID REMISION"`); `folio` es el número que ve el cliente en el recibo.
 */
export interface Sale {
  id: string;
  folio: string;
  branch: string;
  /** `yyyy-MM-dd`. */
  date: string;
  patientName: string;
  sellerName: string;
  total: number;
  discount: number;
  totalWithDiscount: number;
  /** Lo abonado hasta ahora (incluye lo pagado al momento de vender, antes de cualquier abono). */
  account: number;
  /** `totalWithDiscount - account`; 0 = venta liquidada. */
  rest: number;
}
