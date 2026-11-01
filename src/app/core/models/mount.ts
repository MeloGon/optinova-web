/** Armazón del catálogo (= MountModel de Flutter; tabla `armazones`). */
export interface Mount {
  id: number;
  brand: string;
  model: string;
  color: string;
  description: string;
  price: number;
  /** Sucursal donde está el armazón (`armazones.sucursal`; no todas las filas la tienen). */
  branch: string;
  barcode: string;
  stock: number;
}
