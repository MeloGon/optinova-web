/** Un número de página o un hueco ("…"). */
export type PageItem = number | 'gap';

/**
 * Páginas que muestra el paginador (C-08): siempre la primera, la última y la vecindad de la actual.
 * Un hueco de una sola página se escribe completo en vez de "…".
 *
 *   pageItems(1, 13)  → 1 2 3 … 13
 *   pageItems(6, 13)  → 1 … 5 6 7 … 13
 */
export function pageItems(current: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const shown = new Set([1, totalPages, current - 1, current, current + 1]);
  if (current <= 3) [2, 3].forEach((p) => shown.add(p));
  if (current >= totalPages - 2) [totalPages - 2, totalPages - 1].forEach((p) => shown.add(p));

  const sorted = [...shown].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const items: PageItem[] = [];
  sorted.forEach((page, i) => {
    const previous = sorted[i - 1];
    if (previous !== undefined && page - previous === 2) items.push(previous + 1);
    else if (previous !== undefined && page - previous > 2) items.push('gap');
    items.push(page);
  });
  return items;
}
