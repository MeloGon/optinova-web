import { Sale } from '../../core/models/sale';

/** "ADMIN PRUEBA" / "admin prueba" → "Admin Prueba": agrupar por nombre no debe duplicar al
 * mismo vendedor por cómo quedó escrito `autor_nombre` (texto libre, sin FK a `vendedores`). */
function toTitleCase(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function sellerKey(sale: Sale): string {
  const name = sale.sellerName.trim();
  return name ? toTitleCase(name) : 'Sin vendedor';
}
