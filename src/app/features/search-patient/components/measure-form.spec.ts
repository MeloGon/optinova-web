import { createMeasureForm } from './measure-form';

describe('createMeasureForm (P-05 Graduación)', () => {
  it('EJE vacío es válido (no toda medida trae refracción)', () => {
    const form = createMeasureForm();
    expect(form.controls.odEje.valid).toBe(true);
  });

  it('EJE acepta enteros entre 0 y 180', () => {
    const form = createMeasureForm();
    form.controls.odEje.setValue('180');
    expect(form.controls.odEje.valid).toBe(true);
    form.controls.odEje.setValue('0');
    expect(form.controls.odEje.valid).toBe(true);
  });

  it('EJE fuera de 0–180 es inválido', () => {
    const form = createMeasureForm();
    form.controls.odEje.setValue('181');
    expect(form.controls.odEje.valid).toBe(false);
    form.controls.odEje.setValue('-1');
    expect(form.controls.odEje.valid).toBe(false);
  });

  it('EJE con decimales es inválido (el hallazgo de Codex: antes se aceptaban)', () => {
    const form = createMeasureForm();
    form.controls.odEje.setValue('90.5');
    expect(form.controls.odEje.valid).toBe(false);
  });
});
