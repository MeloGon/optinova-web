import { MONTH_OPTIONS, currentMonth, monthLabel, monthRange, toMonth, today, yearOptions } from './month';

describe('month utils', () => {
  describe('monthRange', () => {
    it('devuelve primer y último día de un mes de 31 días', () => {
      expect(monthRange('2026-01')).toEqual({ from: '2026-01-01', to: '2026-01-31' });
    });

    it('devuelve el último día de un mes de 30 días', () => {
      expect(monthRange('2026-04')).toEqual({ from: '2026-04-01', to: '2026-04-30' });
    });

    it('febrero en año común termina el 28', () => {
      expect(monthRange('2026-02').to).toBe('2026-02-28');
    });

    it('febrero en año bisiesto termina el 29', () => {
      expect(monthRange('2028-02').to).toBe('2028-02-29');
    });

    it('1900 no fue bisiesto y 2000 sí', () => {
      expect(monthRange('1900-02').to).toBe('1900-02-28');
      expect(monthRange('2000-02').to).toBe('2000-02-29');
    });

    it('diciembre cierra el año sin pasar a enero', () => {
      expect(monthRange('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    });
  });

  describe('toMonth', () => {
    it('respeta un valor yyyy-MM válido', () => {
      expect(toMonth('2026-11')).toBe('2026-11');
    });

    it('con undefined o vacío cae al mes en curso', () => {
      expect(toMonth(undefined)).toBe(currentMonth());
      expect(toMonth('')).toBe(currentMonth());
    });

    it('con formatos inválidos cae al mes en curso', () => {
      expect(toMonth('noviembre')).toBe(currentMonth());
      expect(toMonth('2026-1')).toBe(currentMonth());
      expect(toMonth('2026-11-05')).toBe(currentMonth());
    });
  });

  describe('currentMonth', () => {
    it('tiene formato yyyy-MM', () => {
      expect(currentMonth()).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
    });
  });

  describe('monthLabel', () => {
    it('escribe el mes en español con el año', () => {
      expect(monthLabel('2026-11')).toBe('Noviembre 2026');
      expect(monthLabel('2026-01')).toBe('Enero 2026');
      expect(monthLabel('2026-12')).toBe('Diciembre 2026');
    });
  });

  describe('MONTH_OPTIONS', () => {
    it('tiene 12 meses con valores 01 a 12', () => {
      expect(MONTH_OPTIONS).toHaveLength(12);
      expect(MONTH_OPTIONS[0]).toEqual({ value: '01', label: 'Enero' });
      expect(MONTH_OPTIONS[11]).toEqual({ value: '12', label: 'Diciembre' });
    });
  });

  describe('yearOptions', () => {
    it('va del año actual 10 hacia atrás, de más nuevo a más viejo', () => {
      const years = yearOptions();
      const current = new Date().getFullYear();

      expect(years).toHaveLength(11);
      expect(years[0]).toBe(current);
      expect(years[10]).toBe(current - 10);
    });
  });

  describe('today', () => {
    it('tiene formato yyyy-MM-dd', () => {
      expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
