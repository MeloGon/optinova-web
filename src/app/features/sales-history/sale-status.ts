import { LucideCircleCheck, LucideCircleDashed, LucideHandCoins, LucideIconInput } from '@lucide/angular';
import { BadgeTone } from '../../shared/ui/badge/badge';
import { Sale } from '../../core/models/sale';

export type SaleStatusLabel = 'Pagado' | 'Con saldo' | 'Pendiente';

export interface SaleStatusInfo {
  label: SaleStatusLabel;
  tone: BadgeTone;
  icon: LucideIconInput;
}

/**
 * Estado de una venta (= S-05): "Pagado" sin saldo, "Pendiente" sin ningún abono todavía,
 * "Con saldo" cuando ya se abonó algo pero falta. No hay "Anulado": esta app no tiene esa
 * función todavía (borrar/anular ventas queda fuera del alcance de E2.5).
 */
export function saleStatus(sale: Sale): SaleStatusInfo {
  if (sale.rest <= 0) return { label: 'Pagado', tone: 'success', icon: LucideCircleCheck };
  if (sale.account <= 0) return { label: 'Pendiente', tone: 'info', icon: LucideCircleDashed };
  return { label: 'Con saldo', tone: 'warning', icon: LucideHandCoins };
}
