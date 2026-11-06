import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SessionStore } from '../../core/auth/session.store';
import { AuthRepository } from '../../core/repositories/auth.repository';
import { FakeAuthRepository } from '../../testing/fake-auth.repository';
import { LoginStore } from './login.store';

describe('LoginStore', () => {
  let auth: FakeAuthRepository;
  let store: LoginStore;
  let router: Router;

  beforeEach(() => {
    auth = new FakeAuthRepository();
    TestBed.configureTestingModule({
      providers: [
        LoginStore,
        provideRouter([{ path: 'dashboard', children: [] }]),
        { provide: AuthRepository, useValue: auth },
      ],
    });
    store = TestBed.inject(LoginStore);
    router = TestBed.inject(Router);
  });

  it('arranca sin error y sin cargar', () => {
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('con credenciales correctas abre sesión y va al dashboard', async () => {
    await store.submit('vendedor@optinova.test', 'secreto123');

    expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(true);
    expect(router.url).toBe('/dashboard');
    expect(store.error()).toBeNull();
  });

  it('recorta los espacios del correo antes de enviarlo', async () => {
    await store.submit('  vendedor@optinova.test  ', 'secreto123');

    expect(TestBed.inject(SessionStore).profile()?.email).toBe('vendedor@optinova.test');
  });

  it('con credenciales incorrectas muestra el error, quita el loading y no navega', async () => {
    await store.submit('vendedor@optinova.test', 'mala');

    expect(store.error()).toBe('Correo o contraseña incorrectos.');
    expect(store.loading()).toBe(false);
    expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(false);
    expect(router.url).toBe('/');
  });

  it('un nuevo intento limpia el error anterior', async () => {
    await store.submit('vendedor@optinova.test', 'mala');
    expect(store.error()).not.toBeNull();

    const pending = store.submit('vendedor@optinova.test', 'secreto123');
    expect(store.error()).toBeNull();
    expect(store.loading()).toBe(true);
    await pending;
  });

  it('clearError() borra el mensaje sin tocar el resto', async () => {
    await store.submit('vendedor@optinova.test', 'mala');
    store.clearError();

    expect(store.error()).toBeNull();
    expect(store.loading()).toBe(false);
  });
});
