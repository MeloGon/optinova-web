import { CurrencyConfig } from '../../core/config/config.service';
import { formatMoney } from './money.pipe';

const pen: CurrencyConfig = { code: 'PEN', symbol: 'S/.', locale: 'en-US', decimals: 2 };

describe('formatMoney', () => {
  it('miles con coma y 2 decimales', () => {
    expect(formatMoney(1250, pen)).toBe('S/. 1,250.00');
    expect(formatMoney(4870.5, pen)).toBe('S/. 4,870.50');
  });

  it('cero', () => {
    expect(formatMoney(0, pen)).toBe('S/. 0.00');
  });

  it('negativo con menos tipográfico', () => {
    expect(formatMoney(-124, pen)).toBe('−S/. 124.00');
  });
});
