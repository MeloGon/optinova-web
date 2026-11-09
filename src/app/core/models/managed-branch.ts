/** Una sucursal tal como la administra un admin (fila de `sucursales`). */
export interface ManagedBranch {
  id: number;
  name: string;
  /** `false` = cerrada: sigue en filtros e historial, pero no se ofrece al crear registros. */
  active: boolean;
  companyId: string;
  companyName: string;
}
