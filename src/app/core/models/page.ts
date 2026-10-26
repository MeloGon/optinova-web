/** Una página de resultados y cuántos hay en total (para "Mostrando 1–25 de 128"). */
export interface Page<T> {
  items: T[];
  total: number;
}
