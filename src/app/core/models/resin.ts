/** Resina/lente del catálogo (= ResinModel de Flutter; tabla `resinas`). */
export interface Resin {
  id: number;
  description: string;
  design: string;
  line: string;
  material: string;
  technology: string;
  text: string;
  quantity: number;
  price: number;
  /** Precio interno, solo de referencia para el vendedor; no se muestra al paciente. */
  priceInternal: number;
}
