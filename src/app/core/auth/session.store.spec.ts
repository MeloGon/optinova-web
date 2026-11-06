import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Profile } from '../models/profile';
import { AuthRepository } from '../repositories/auth.repository';
import { FakeAuthRepository, fakeProfile } from '../../testing/fake-auth.repository';
import { SessionStore } from './session.store';

/** Igual que el fake, pero guarda el callback para poder simular "la sesión terminó sola". */
class SignOutCapturingAuth extends FakeAuthRepository {
  private callback: (() => void) | null = null;

  override onSignedOut(callback?: () => void): void {
    this.callback = callback ?? null;
  }

  expireSession(): void {
    this.callback?.();
  }
}

describe('SessionStore', () => {
  let auth: SignOutCapturingAuth;
  let store: SessionStore;
  let router: Router;

  function setup(session: Profile | null = null): void {
    TestBed.resetTestingModule();
    auth = new SignOutCapturingAuth();
    auth.session = session;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'auth/login', children: [] },
          { path: 'dashboard', children: [] },
        ]),
        { provide: AuthRepository, useValue: auth },
      ],
    });
    store = TestBed.inject(SessionStore);
    router = TestBed.inject(Router);
  }

  it('arranca sin sesión', () => {
    setup();
    expect(store.isAuthenticated()).toBe(false);
    expect(store.profile()).toBeNull();
  });

  it('restore() recupera la sesión guardada', async () => {
    setup(fakeProfile('supervisor'));
    await store.restore();

    expect(store.isAuthenticated()).toBe(true);
    expect(store.profile()?.role).toBe('supervisor');
  });

  it('restore() sin sesión guardada deja el estado vacío', async () => {
    setup();
    await store.restore();
    expect(store.isAuthenticated()).toBe(false);
  });

  describe('login', () => {
    it('con credenciales correctas guarda el perfil', async () => {
      setup();
      const result = await store.login('vendedor@optinova.test', 'secreto123');

      expect(result.ok).toBe(true);
      expect(store.profile()?.email).toBe('vendedor@optinova.test');
      expect(store.isAuthenticated()).toBe(true);
    });

    it('con credenciales incorrectas no abre sesión y devuelve el error', async () => {
      setup();
      const result = await store.login('vendedor@optinova.test', 'mala');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toBe('Correo o contraseña incorrectos.');
      expect(store.isAuthenticated()).toBe(false);
    });
  });

  describe('logout', () => {
    it('limpia el estado, cierra en el repositorio y va al login', async () => {
      setup(fakeProfile('admin'));
      await store.restore();

      await store.logout();

      expect(store.isAuthenticated()).toBe(false);
      expect(auth.session).toBeNull();
      expect(router.url).toBe('/auth/login');
    });
  });

  describe('sesión que termina sola', () => {
    it('limpia el estado y vuelve al login', async () => {
      setup(fakeProfile('vendedor'));
      await store.restore();
      await router.navigateByUrl('/dashboard');

      auth.expireSession();
      await router.navigateByUrl(router.url); // deja terminar la navegación pendiente

      expect(store.isAuthenticated()).toBe(false);
    });

    it('sin sesión activa no navega (evita un bucle al cerrar sesión a mano)', async () => {
      setup();
      await store.restore();
      await router.navigateByUrl('/dashboard');

      auth.expireSession();

      expect(router.url).toBe('/dashboard');
    });
  });

  describe('can()', () => {
    it('sin sesión nunca tiene rol', () => {
      setup();
      expect(store.can('vendedor')).toBe(false);
    });

    it('respeta la jerarquía de roles', async () => {
      setup(fakeProfile('supervisor'));
      await store.restore();

      expect(store.can('vendedor')).toBe(true);
      expect(store.can('supervisor')).toBe(true);
      expect(store.can('admin')).toBe(false);
      expect(store.can('megadmin')).toBe(false);
    });
  });
});
