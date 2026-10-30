import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideBanknote,
  LucideBriefcase,
  LucideCircleCheck,
  LucideCircleDashed,
  LucideCreditCard,
  LucideDynamicIcon,
  LucideIconInput,
  LucideLandmark,
  LucideSmartphone,
  LucideTriangleAlert,
} from '@lucide/angular';
import { ConfigService } from '../../../core/config/config.service';
import { AppError } from '../../../core/errors/app-error';
import { Sale } from '../../../core/models/sale';
import { NewPayment } from '../../../core/repositories/payment.repository';
import { Result } from '../../../core/result';
import { MoneyPipe, formatMoney } from '../../../shared/pipes/money.pipe';
import { DatePicker } from '../../../shared/ui/date-picker/date-picker';
import { Field } from '../../../shared/ui/field/field';
import { OnvInput } from '../../../shared/ui/field/input';

export interface RegisterPaymentDialogData {
  sale: Sale;
  save: (draft: NewPayment) => Promise<Result<void, AppError>>;
}

export const REGISTER_PAYMENT_TITLE_ID = 'register-payment-title';

/** Mismos íconos que S-05: un botón grande por método, no un `<select>`. */
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
 * Registrar abono (C-12 con formulario). = "Registrar pago" de S-05 (detalle de venta): importe
 * precargado con el saldo completo, método como botones con ícono y aviso de cómo queda la venta.
 */
@Component({
  selector: 'app-register-payment-dialog',
  imports: [ReactiveFormsModule, LucideDynamicIcon, MoneyPipe, DatePicker, Field, OnvInput],
  templateUrl: './register-payment-dialog.html',
  host: {
    class: 'block w-[440px] max-w-[calc(100vw-2rem)] rounded-xl bg-card text-card-foreground elev-xl',
    '(keydown.escape)': 'cancel()',
  },
})
export class RegisterPaymentDialog {
  private readonly data = inject<RegisterPaymentDialogData>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly config = inject(ConfigService).config;

  protected readonly titleId = REGISTER_PAYMENT_TITLE_ID;
  protected readonly alertIcon = LucideTriangleAlert;
  protected readonly okIcon = LucideCircleCheck;
  protected readonly sale = this.data.sale;
  protected readonly methods = this.config().paymentMethods.map((m) => ({ ...m, icon: METHOD_ICONS[m.value] }));

  protected readonly form = new FormGroup({
    amount: new FormControl<number | null>(Number(this.sale.rest.toFixed(2)), [Validators.required, Validators.min(0.01)]),
    paymentMethod: new FormControl(this.methods[0]?.value ?? 'efectivo', { nonNullable: true }),
    date: new FormControl(today(), { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  /** "la venta quedará Pagada" o "quedará con S/. X de saldo", según lo que se vaya a abonar. */
  protected readonly resultLabel = computed(() => {
    const amount = this.form.controls.amount.value ?? 0;
    const remaining = Math.max(this.sale.rest - amount, 0);
    return remaining <= 0 ? 'Pagada' : formatMoney(remaining, this.config().currency) + ' de saldo';
  });

  protected readonly submitLabel = computed(() => {
    const amount = this.form.controls.amount.value ?? 0;
    return `Registrar ${formatMoney(amount, this.config().currency)}`;
  });

  protected selectMethod(value: string): void {
    this.form.controls.paymentMethod.setValue(value);
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    const amount = value.amount ?? 0;

    if (this.form.invalid || this.saving()) return;
    if (amount > this.sale.rest) {
      this.error.set(`El abono no puede superar el saldo (${formatMoney(this.sale.rest, this.config().currency)}).`);
      return;
    }

    const draft: NewPayment = {
      saleId: this.sale.id,
      amount,
      date: value.date,
      paymentMethod: value.paymentMethod,
      notes: '',
    };

    this.saving.set(true);
    this.error.set(null);
    const result = await this.data.save(draft);
    this.saving.set(false);

    if (result.ok) this.ref.close(true);
    else this.error.set(result.error.message);
  }

  protected cancel(): void {
    if (!this.saving()) this.ref.close(false);
  }
}
