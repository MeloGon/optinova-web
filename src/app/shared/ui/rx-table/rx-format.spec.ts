import { formatAxis, formatDiopter, normalizeDiopterInput, rxTone, stepAxis, stepDiopter } from './rx-format';

describe('rx-format (P-05 Graduación)', () => {
  describe('formatDiopter', () => {
    it('vacío se muestra como raya', () => {
      expect(formatDiopter('')).toBe('—');
      expect(formatDiopter('   ')).toBe('—');
    });

    it('cero siempre con dos decimales, sin signo', () => {
      expect(formatDiopter('0')).toBe('0.00');
      expect(formatDiopter('-0')).toBe('0.00');
    });

    it('positivo lleva signo +', () => {
      expect(formatDiopter('1.75')).toBe('+1.75');
      expect(formatDiopter('+1.5')).toBe('+1.50');
    });

    it('negativo lleva el signo menos tipográfico (−), no el guion ASCII', () => {
      expect(formatDiopter('-1.25')).toBe('−1.25');
      expect(formatDiopter('-1')).toBe('−1.00');
    });

    it('texto que no es número se muestra tal cual', () => {
      expect(formatDiopter('plano')).toBe('plano');
    });
  });

  describe('formatAxis', () => {
    it('redondea a entero y agrega °', () => {
      expect(formatAxis('90')).toBe('90°');
      expect(formatAxis('89.6')).toBe('90°');
    });

    it('vacío se muestra como raya', () => {
      expect(formatAxis('')).toBe('—');
    });
  });

  describe('rxTone', () => {
    it('clasifica positivo, negativo, cero y vacío', () => {
      expect(rxTone('1.5')).toBe('pos');
      expect(rxTone('-1.5')).toBe('neg');
      expect(rxTone('0')).toBe('zero');
      expect(rxTone('')).toBe('empty');
      expect(rxTone('plano')).toBe('text');
    });
  });

  describe('normalizeDiopterInput (atajo de captura rápida)', () => {
    it('solo dígitos sin punto se leen como centésimas', () => {
      expect(normalizeDiopterInput('125')).toBe('+1.25');
      expect(normalizeDiopterInput('-125')).toBe('−1.25');
      expect(normalizeDiopterInput('50')).toBe('+0.50');
    });

    it('un valor con punto decimal no se toca', () => {
      expect(normalizeDiopterInput('1.25')).toBe('+1.25');
      expect(normalizeDiopterInput('-1.5')).toBe('−1.50');
    });

    it('vacío se queda vacío (no se fuerza un valor)', () => {
      expect(normalizeDiopterInput('')).toBe('');
      expect(normalizeDiopterInput('   ')).toBe('');
    });
  });

  describe('stepDiopter / stepAxis', () => {
    it('suma el paso y devuelve el texto ya formateado', () => {
      expect(stepDiopter('-1.00', 0.25)).toBe('−0.75');
      expect(stepDiopter('', 0.25)).toBe('+0.25');
    });

    it('EJE queda acotado entre 0 y 180', () => {
      expect(stepAxis('180', 1)).toBe('180');
      expect(stepAxis('0', -1)).toBe('0');
      expect(stepAxis('90', 1)).toBe('91');
    });

    it('baja y vuelve a subir: el valor ya formateado (con el signo −) se puede volver a leer', () => {
      // Bug reportado: -1.75 → ↓ → -2.00 → ↑ debía volver a -1.75, pero daba +0.25 porque
      // stepDiopter no sabía leer el "−" tipográfico que el propio formatDiopter había puesto.
      const afterDown = stepDiopter('-1.75', -0.25);
      expect(afterDown).toBe('−2.00');
      expect(stepDiopter(afterDown, 0.25)).toBe('−1.75');
    });

    it('la coma decimal se entiende igual que el punto', () => {
      expect(stepDiopter('-1,75', -0.25)).toBe('−2.00');
    });
  });
});
