import { Dialog } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  LucideBanknote,
  LucideBriefcase,
  LucideCircleCheck,
  LucideCircleDashed,
  LucideCreditCard,
  LucideDynamicIcon,
  LucideHandCoins,
  LucideIconInput,
  LucideLandmark,
  LucideLock,
  LucideSmartphone,
  LucideTrash2,
} from '@lucide/angular';
import { ConfigService } from '../../../core/config/config.service';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { DatePicker } from '../../../shared/ui/date-picker/date-picker';
import { RxTable } from '../../../shared/ui/rx-table/rx-table';
import { SUPERVISOR_AUTH_TITLE_ID, SupervisorAuthDialog, SupervisorAuthDialogData } from '../../../shared/ui/supervisor-auth-dialog/supervisor-auth-dialog';
import { OnvTable } from '../../../shared/ui/table/table';
import { CartLine, SellStore } from '../sell.store';

/** Mismos íconos que S-05/Registrar abono: un botón por método, no un `<select>`. */
const METHOD_ICONS: Record<string, LucideIconInput> = {
  efectivo: LucideBanknote,
  tarjeta: LucideCreditCard,
  transferencia: LucideLandmark,
  yape: LucideSmartphone,
  nomina: LucideBriefcase,
  otro: LucideCircleDashed,
};

/** Hoy como `yyyy-MM-dd`. */
function today(): string {
  return new Date().toLocaleDateString('en-CA');
}

/**
 * Paso 3 de Vender (= S-04 paso 3): nota de venta a la izquierda (vendedor, sucursal, fecha,
 * precios editables, graduación) y resumen de cobro (P-06) a la derecha. El descuento especial lo
 * da directo cualquier rol, salvo que la sucursal exija autorización para vendedores: entonces se
 * abre el diálogo P-04 (correo y contraseña de un supervisor, sin cerrar la sesión del vendedor).
 */
@Component({
  selector: 'app-sell-checkout-step',
  imports: [ReactiveFormsModule, DatePipe, MoneyPipe, LucideDynamicIcon, DatePicker, RxTable, OnvTable],
  templateUrl: './checkout-step.html',
})
export class CheckoutStep {
  protected readonly store = inject(SellStore);
  protected readonly config = inject(ConfigService).config;
  private readonly dialog = inject(Dialog);

  protected readonly branches = computed(() => this.config().branches);
  protected readonly methods = computed(() => this.config().paymentMethods.map((m) => ({ ...m, icon: METHOD_ICONS[m.value] })));

  protected readonly dateControl = new FormControl(today(), { nonNullable: true });
  protected readonly discountAmount = new FormControl<number | null>(null);
  protected readonly discountReason = new FormControl('', { nonNullable: true });

  protected readonly icons = {
    trash: LucideTrash2,
    balance: LucideHandCoins,
    paid: LucideCircleCheck,
    lock: LucideLock,
  };

  constructor() {
    this.dateControl.setValue(this.store.date());
    this.dateControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => this.store.setDate(value));

    this.discountAmount.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.store.setDiscount(value ?? 0, this.discountReason.value);
    });
    this.discountReason.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.store.setDiscount(this.discountAmount.value ?? 0, value);
    });
  }

  protected async askAuthorization(): Promise<void> {
    const data: SupervisorAuthDialogData = {
      description: `Descuento de ${this.store.discount().toFixed(2)} sobre esta venta.`,
      confirmLabel: 'Autorizar descuento',
      authorize: (email, password) => this.store.authorizeDiscount(email, password),
    };
    this.dialog.open<boolean>(SupervisorAuthDialog, {
      data,
      role: 'dialog',
      ariaLabelledBy: SUPERVISOR_AUTH_TITLE_ID,
      disableClose: true,
      backdropClass: ['bg-overlay'],
    });
  }

  protected setBranch(value: string): void {
    this.store.setBranch(value);
  }

  protected setSeller(id: string): void {
    const seller = this.store.sellers().find((s) => String(s.id) === id);
    this.store.setSeller(seller ?? null);
  }

  protected updatePrice(line: CartLine, raw: string): void {
    const price = Number(raw);
    if (Number.isFinite(price) && price >= 0) this.store.updateCartLinePrice(line.localId, price);
  }

  protected setAccount(raw: string): void {
    const amount = Number(raw);
    this.store.setAccount(Number.isFinite(amount) ? amount : 0);
  }

  protected setMethod(value: string): void {
    this.store.setPaymentMethod(value);
  }
}
