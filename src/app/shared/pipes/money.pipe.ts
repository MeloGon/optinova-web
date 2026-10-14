import { Pipe, PipeTransform, inject } from '@angular/core';
import { ConfigService, CurrencyConfig } from '../../core/config/config.service';

/** `1250` → `S/. 1,250.00` · `-124` → `−S/. 124.00` (menos tipográfico). */
export function formatMoney(amount: number, currency: CurrencyConfig): string {
  const digits = new Intl.NumberFormat(currency.locale, {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  }).format(Math.abs(amount));
  const sign = amount < 0 ? '−' : '';
  return `${sign}${currency.symbol} ${digits}`;
}

/**
 * Único lugar donde se formatea dinero (regla 4b). En plantillas: `{{ total | money }}`.
 * Equivale a un NumberFormat.currency de intl, pero con la moneda de la empresa.
 */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  private readonly config = inject(ConfigService).config;

  transform(amount: number | null | undefined): string {
    if (amount == null) return '';
    return formatMoney(amount, this.config().currency);
  }
}
