/** `data` de cada ruta del dashboard: el topbar (C-21) muestra title y description. */
export interface PageData {
  title: string;
  description?: string;
  /** Entregable del plan donde se construye la página (solo para las páginas pendientes). */
  delivery?: string;
}
