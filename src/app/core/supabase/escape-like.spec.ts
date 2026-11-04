import { escapeLike } from './escape-like';

describe('escapeLike', () => {
  it('escapa el guión bajo con una sola barra (bug de Antigravity, 2026-11-04: antes salían dos)', () => {
    expect(escapeLike('create_resin')).toBe('create\\_resin');
  });

  it('escapa % y \\ también', () => {
    expect(escapeLike('100% \\ ok')).toBe('100\\% \\\\ ok');
  });

  it('deja el resto del texto igual', () => {
    expect(escapeLike('admin@optinova.test')).toBe('admin@optinova.test');
  });
});
