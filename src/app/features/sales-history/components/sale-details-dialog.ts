import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject } from '@angular/core';
import { LucideDynamicIcon, LucideX } from '@lucide/angular';
import { Payment } from '../../../core/models/payment';
import { Sale } from '../../../core/models/sale';
import { SaleItem } from '../../../core/models/sale-item';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { Badge } from '../../../shared/ui/badge/badge';
import { saleStatus } from '../sale-status';

export interface SaleDetailsDialogData {
  sale: Sale;
  items: SaleItem[];
  payments: Payment[];
}

export const SALE_DETAILS_TITLE_ID = 'sale-details-title';

/** Se cierra con `'pay'` cuando se pide abonar desde aquí: la página abre el diálogo de pago. */
export type SaleDetailsResult = 'pay' | undefined;

/**
 * Ver detalle de una venta (C-12 lg, solo lectura). = S-05 detalle: dl de paciente/descuento,
 * tabla de productos y tabla de pagos. Sin "Anular…" ni "Imprimir" (anular es una feature nueva
 * que no existe todavía; imprimir el recibo es E2.6).
 */
@Component({
  selector: 'app-sale-details-dialog',
  imports: [LucideDynamicIcon, MoneyPipe, Badge],
  templateUrl: './sale-details-dialog.html',
  host: {
    class: 'block w-[640px] max-w-[calc(100vw-2rem)] rounded-xl bg-card text-card-foreground elev-xl',
    '(keydown.escape)': 'close()',
  },
})
export class SaleDetailsDialog {
  private readonly data = inject<SaleDetailsDialogData>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<SaleDetailsResult>>(DialogRef);

  protected readonly titleId = SALE_DETAILS_TITLE_ID;
  protected readonly closeIcon = LucideX;
  protected readonly sale = this.data.sale;
  protected readonly status = saleStatus(this.sale);
  protected readonly items = this.data.items;
  protected readonly payments = this.data.payments;

  /**
   * Una línea por producto (= la tabla "Productos" de S-05). Cada fila de `venta_items` trae lente
   * o montura, nunca las dos: se muestra la que tenga datos.
   */
  protected readonly lines = computed(() =>
    this.items.map((item) => ({
      name: item.description || item.mount || item.mountBrand || 'Producto',
      quantity: item.quantity || item.mountQuantity || '1',
      amount: item.price || item.mountPrice,
    })),
  );

  protected readonly linesTotal = computed(() => this.lines().reduce((sum, l) => sum + l.amount, 0));

  protected close(): void {
    this.ref.close();
  }

  protected openPayment(): void {
    this.ref.close('pay');
  }
}
