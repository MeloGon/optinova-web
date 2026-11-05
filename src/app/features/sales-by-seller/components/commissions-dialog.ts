import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { Field } from '../../../shared/ui/field/field';
import { OnvInput } from '../../../shared/ui/field/input';
import { SellerAggregate } from '../../../core/repositories/sales-by-seller-report.repository';

export interface CommissionsDialogData {
  sellers: SellerAggregate[];
}

export const COMMISSIONS_DIALOG_TITLE_ID = 'commissions-dialog-title';

/**
 * Calculadora de comisiones (= CommissionsDialog de Flutter): un porcentaje sobre el total
 * vendido de cada vendedor del período filtrado. No se guarda en ningún lado, es solo para
 * simular; se recalcula solo al escribir, sin botón "Calcular" (= el resto de la app, que
 * siempre deriva sus totales de signals).
 */
@Component({
  selector: 'app-commissions-dialog',
  imports: [ReactiveFormsModule, MoneyPipe, Field, OnvInput],
  templateUrl: './commissions-dialog.html',
  host: {
    class: 'block w-[480px] max-w-[calc(100vw-2rem)] rounded-xl bg-card text-card-foreground elev-xl',
    '(keydown.escape)': 'close()',
  },
})
export class CommissionsDialog {
  private readonly data = inject<CommissionsDialogData>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<void>>(DialogRef);

  protected readonly titleId = COMMISSIONS_DIALOG_TITLE_ID;
  protected readonly sellers = this.data.sellers;

  protected readonly pctControl = new FormControl<number | null>(null, [Validators.min(0.01)]);
  private readonly pct = toSignal(this.pctControl.valueChanges, { initialValue: null });

  protected readonly rows = computed(() => {
    const pct = this.pct();
    return this.sellers.map((seller) => ({
      ...seller,
      commission: pct && pct > 0 ? seller.total * (pct / 100) : null,
    }));
  });

  protected readonly grandTotalCommission = computed(() => this.rows().reduce((sum, r) => sum + (r.commission ?? 0), 0));

  protected close(): void {
    this.ref.close();
  }
}
