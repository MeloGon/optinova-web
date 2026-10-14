import { hasRole } from './role';

describe('hasRole', () => {
  it('un rol mayor cumple uno menor', () => {
    expect(hasRole('admin', 'supervisor')).toBe(true);
    expect(hasRole('megadmin', 'admin')).toBe(true);
  });

  it('el mismo rol cumple', () => {
    expect(hasRole('vendedor', 'vendedor')).toBe(true);
  });

  it('un rol menor no cumple uno mayor', () => {
    expect(hasRole('supervisor', 'admin')).toBe(false);
  });
});
