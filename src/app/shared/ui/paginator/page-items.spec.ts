import { pageItems } from './page-items';

describe('pageItems', () => {
  it('con pocas páginas las muestra todas', () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('al inicio muestra 1 2 3 … última', () => {
    expect(pageItems(1, 13)).toEqual([1, 2, 3, 'gap', 13]);
  });

  it('en el medio rodea la actual con huecos', () => {
    expect(pageItems(6, 13)).toEqual([1, 'gap', 5, 6, 7, 'gap', 13]);
  });

  it('al final muestra 1 … antepenúltima última', () => {
    expect(pageItems(13, 13)).toEqual([1, 'gap', 11, 12, 13]);
  });

  it('un hueco de una sola página se escribe completo', () => {
    expect(pageItems(4, 13)).toEqual([1, 2, 3, 4, 5, 'gap', 13]);
    expect(pageItems(10, 13)).toEqual([1, 'gap', 9, 10, 11, 12, 13]);
  });

  it('nunca pasa de 7 posiciones', () => {
    for (let total = 8; total <= 40; total++) {
      for (let current = 1; current <= total; current++) {
        expect(pageItems(current, total).length).toBeLessThanOrEqual(7);
      }
    }
  });
});
