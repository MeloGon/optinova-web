/** Egreso (= ExpenseModel de Flutter). Las fechas son texto `yyyy-MM-dd` (columna `date`). */
export interface Expense {
  id: string;
  date: string;
  categoryId: number | null;
  /** Nombre y color de la categoría, traídos por `join` (`categorias_egresos`); null sin categoría. */
  categoryName: string | null;
  categoryColor: string | null;
  description: string;
  amount: number;
  /** Texto de `ConfigService.config().paymentMethods` (efectivo, tarjeta...). */
  paymentMethod: string;
  receipt: string;
  /** Texto de `ConfigService.config().branches`; vacío = egreso global, no de una sucursal. */
  branch: string;
  /** Nombre de quien lo registró; lo pone la app con el perfil de la sesión, no un campo del formulario. */
  registeredBy: string;
  notes: string;
}
