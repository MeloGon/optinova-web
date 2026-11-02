import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { LucideCircleCheck, LucideDynamicIcon, LucidePrinter } from '@lucide/angular';
import { Sale } from '../../../core/models/sale';
import { NewSaleItem } from '../../../core/models/sale-item';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { ReceiptPdfService, newSaleItemToReceiptLine } from '../../../shared/services/receipt-pdf.service';

export interface SaleCreatedDialogData {
  sale: Sale;
  items: NewSaleItem[];
}

export const SALE_CREATED_TITLE_ID = 'sale-created-title';

/** Se cierra con `'view'` cuando se pide ver la venta: la página navega a Historial de ventas. */
export type SaleCreatedResult = 'view' | undefined;

/**
 * Confirmación visual al crear una venta (pedido del dueño tras probar, 2026-10-31: un toast solo
 * no alcanzaba). "Imprimir recibo" genera el ticket 80mm con `ReceiptPdfService` (= llamar a
 * `ReceiptPdfService.generateAndDownloadReceipt` justo después de crear la venta, en Flutter).
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
  private readonly receiptPdf = inject(ReceiptPdfService);

  protected readonly titleId = SALE_CREATED_TITLE_ID;
  protected readonly checkIcon = LucideCircleCheck;
  protected readonly printIcon = LucidePrinter;
  protected readonly sale = this.data.sale;
  protected readonly printing = signal(false);

  protected close(): void {
    this.ref.close();
  }

  protected viewSale(): void {
    this.ref.close('view');
  }

  protected async printReceipt(): Promise<void> {
    this.printing.set(true);
    try {
      await this.receiptPdf.print(this.sale, this.data.items.map(newSaleItemToReceiptLine));
    } finally {
      this.printing.set(false);
    }
  }
}
