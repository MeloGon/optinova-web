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

/**
 * Línea nueva a insertar (= un producto agregado al carrito de Vender). Cada línea es siempre
 * 1 unidad (igual que Flutter: no hay selector de cantidad, cada clic en "Agregar" crea una línea
 * más; vender 3 armazones iguales son 3 líneas con el mismo `mountId`, no una línea con cantidad 3).
 * A diferencia de `SaleItem` (que lee cualquier fila ya aplanada), acá se modela como unión
 * discriminada: una línea nueva es una resina o un armazón, nunca ambos campos sueltos a la vez.
 */
export type NewSaleItem =
  | {
      kind: 'resin';
      resinId: number;
      description: string;
      design: string;
      line: string;
      material: string;
      technology: string;
      text: string;
      price: number;
    }
  | {
      kind: 'mount';
      /** Texto, no número: ver el comentario de `Mount.id`. */
      mountId: string;
      mountBrand: string;
      mountModel: string;
      mountColor: string;
      mountText: string;
      price: number;
    };
