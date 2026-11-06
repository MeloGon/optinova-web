import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Role } from '../models/role';
import { AuthRepository } from '../repositories/auth.repository';
import { FakeAuthRepository, fakeProfile } from '../../testing/fake-auth.repository';
import { SessionStore } from './session.store';
import { authGuard, guestGuard, roleGuard } from './guards';

describe('guards', () => {
  /** Arranca el store con (o sin) sesión y corre el guard como lo haría el router. */
  async function run(guard: typeof authGuard, role: Role | null): Promise<boolean | string> {
    TestBed.resetTestingModule();
    const auth = new FakeAuthRepository();
    auth.session = role ? fakeProfile(role) : null;
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthRepository, useValue: auth }],
    });
    await TestBed.inject(SessionStore).restore();

    const result = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as boolean | UrlTree;
    return result instanceof UrlTree ? result.toString() : result;
  }

  describe('authGuard', () => {
    it('sin sesión redirige al login', async () => {
      expect(await run(authGuard, null)).toBe('/auth/login');
    });

    it('con sesión deja pasar', async () => {
      expect(await run(authGuard, 'vendedor')).toBe(true);
    });
  });

  describe('guestGuard', () => {
    it('sin sesión deja ver el login', async () => {
      expect(await run(guestGuard, null)).toBe(true);
    });

    it('con sesión manda al dashboard', async () => {
      expect(await run(guestGuard, 'vendedor')).toBe('/dashboard');
    });
  });

  describe('roleGuard', () => {
    it('sin sesión manda al dashboard (el authGuard ya lo llevaría al login)', async () => {
      expect(await run(roleGuard('supervisor'), null)).toBe('/dashboard');
    });

    it('un rol menor al mínimo se bloquea', async () => {
      expect(await run(roleGuard('admin'), 'vendedor')).toBe('/dashboard');
      expect(await run(roleGuard('admin'), 'supervisor')).toBe('/dashboard');
    });

    it('el rol exacto y los superiores pasan', async () => {
      expect(await run(roleGuard('admin'), 'admin')).toBe(true);
      expect(await run(roleGuard('admin'), 'megadmin')).toBe(true);
    });

    it('megadmin pasa cualquier mínimo', async () => {
      for (const min of ['vendedor', 'supervisor', 'admin', 'megadmin'] as Role[]) {
        expect(await run(roleGuard(min), 'megadmin')).toBe(true);
      }
    });
  });
});
