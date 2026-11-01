import { DatePipe } from '@angular/common';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { LucideCircleAlert, LucideDynamicIcon, LucideReceipt } from '@lucide/angular';
import { AppError } from '../../../core/errors/app-error';
import { Result } from '../../../core/result';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { SellSnapshot } from '../sell.store';

export interface SalePreviewItem {
  label: string;
  kind: 'mount' | 'resin';
  price: number;
}

export interface SalePreviewDialogData {
  patientName: string;
  sellerName: string;
  branch: string;
  /** `yyyy-MM-dd`. */
  date: string;
  items: SalePreviewItem[];
  total: number;
  discount: number;
  discountReason: string | null;
  totalWithDiscount: number;
  account: number;
  rest: number;
  paymentMethodLabel: string | null;
  /** Crea la venta de verdad al confirmar desde este diálogo. */
  confirm: () => Promise<Result<SellSnapshot, AppError>>;
}

export const SALE_PREVIEW_TITLE_ID = 'sale-preview-title';

/**
 * Vista previa de la venta antes de guardarla (pedido del dueño tras probar, 2026-11-01): un
 * "ticket" simulado para revisar todo antes de confirmar. No es el recibo que se va a imprimir
 * (eso es un entregable aparte de E2.6, con pdfmake): folio y fecha reales todavía no existen
 * en este punto, por eso el ticket los marca como pendientes en vez de inventarlos.
 */
@Component({
  selector: 'app-sale-preview-dialog',
  imports: [DatePipe, MoneyPipe, LucideDynamicIcon],
  templateUrl: './sale-preview-dialog.html',
  host: {
    class: 'block w-[400px] max-w-[calc(100vw-2rem)] rounded-xl bg-card text-card-foreground elev-xl',
    '(keydown.escape)': 'cancel()',
  },
})
export class SalePreviewDialog {
  protected readonly data = inject<SalePreviewDialogData>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<SellSnapshot | undefined>>(DialogRef);

  protected readonly titleId = SALE_PREVIEW_TITLE_ID;
  protected readonly receiptIcon = LucideReceipt;
  protected readonly alertIcon = LucideCircleAlert;

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async confirm(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    const result = await this.data.confirm();
    if (result.ok) {
      this.ref.close(result.value);
      return;
    }
    this.saving.set(false);
    this.error.set(result.error.message);
  }

  protected cancel(): void {
    if (this.saving()) return;
    this.ref.close(undefined);
  }
}
