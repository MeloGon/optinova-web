/**
 * Línea vendida dentro de una venta (= SalesDetailsModel de Flutter; tabla `venta_items`).
 * Lente y montura están aplanados en la misma fila, como en PROD: una línea puede traer uno,
 * otro o ambos.
 */
export interface SaleItem {
  id: number;
  description: string;
  design: string;
  line: string;
  material: string;
  technology: string;
  serie: string;
  text: string;
  quantity: string;
  price: number;
  mount: string;
  mountBrand: string;
  mountModel: string;
  mountColor: string;
  mountQuantity: string;
  mountPrice: number;
  mountText: string;
}
