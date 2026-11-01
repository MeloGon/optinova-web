import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { LucideCircleCheck, LucideDynamicIcon } from '@lucide/angular';
import { Sale } from '../../../core/models/sale';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';

export interface SaleCreatedDialogData {
  sale: Sale;
}

export const SALE_CREATED_TITLE_ID = 'sale-created-title';

/** Se cierra con `'view'` cuando se pide ver la venta: la página navega a Historial de ventas. */
export type SaleCreatedResult = 'view' | undefined;

/**
 * Confirmación visual al crear una venta (pedido del dueño tras probar, 2026-10-31: un toast solo
 * no alcanzaba). Sin "Imprimir recibo" todavía: el ticket PDF es un entregable aparte de E2.6.
 */
@Component({
  selector: 'app-sale-created-dialog',
  imports: [LucideDynamicIcon, MoneyPipe],
  templateUrl: './sale-created-dialog.html',
  host: {
    class: 'block w-[400px] max-w-[calc(100vw-2rem)] rounded-xl bg-card text-card-foreground elev-xl',
    '(keydown.escape)': 'close()',
  },
})
export class SaleCreatedDialog {
  private readonly data = inject<SaleCreatedDialogData>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<SaleCreatedResult>>(DialogRef);

  protected readonly titleId = SALE_CREATED_TITLE_ID;
  protected readonly checkIcon = LucideCircleCheck;
  protected readonly sale = this.data.sale;

  protected close(): void {
    this.ref.close();
  }

  protected viewSale(): void {
    this.ref.close('view');
  }
}
