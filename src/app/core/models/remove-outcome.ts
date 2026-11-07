/**
 * Qué pasó al "eliminar" un armazón o una resina: `deleted` si nunca se vendió (se borra de
 * verdad) o `archived` si ya aparece en alguna venta (se oculta del catálogo e inventario, pero
 * sigue existiendo para que el historial de ventas no quede apuntando a algo que no está).
 */
export type RemoveOutcome = 'deleted' | 'archived';
