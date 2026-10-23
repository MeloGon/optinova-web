import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { SessionStore } from './core/auth/session.store';
import { Role } from './core/models/role';
import { AuthRepository } from './core/repositories/auth.repository';
import { FakeAuthRepository, fakeProfile } from './testing/fake-auth.repository';

describe('Rutas y guards', () => {
  let repo: FakeAuthRepository;

  /** Arranca la app con (o sin) sesión, como provideAppInitializer. */
  async function start(role: Role | null): Promise<RouterTestingHarness> {
    repo = new FakeAuthRepository();
    repo.session = role ? fakeProfile(role) : null;
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        { provide: AuthRepository, useValue: repo },
      ],
    });
    await TestBed.inject(SessionStore).restore();
    return RouterTestingHarness.create();
  }

  const url = () => TestBed.inject(Router).url;
  const text = (h: RouterTestingHarness) => (h.routeNativeElement as HTMLElement).textContent ?? '';

  it('sin sesión, la raíz y el dashboard mandan al login', async () => {
    const h = await start(null);
    await h.navigateByUrl('/');
    expect(url()).toBe('/auth/login');
    await h.navigateByUrl('/dashboard/sell');
    expect(url()).toBe('/auth/login');
    expect(text(h)).toContain('Inicia sesión');
  });

  it('con sesión, el login manda al dashboard', async () => {
    const h = await start('vendedor');
    await h.navigateByUrl('/auth/login');
    expect(url()).toBe('/dashboard');
  });

  it('una página pendiente muestra su título y su entregable', async () => {
    const h = await start('vendedor');
    await h.navigateByUrl('/dashboard/sell');
    expect(text(h)).toContain('Nueva venta');
    expect(text(h)).toContain('E2.6');
  });

  it('un vendedor no entra a páginas de admin', async () => {
    const h = await start('vendedor');
    await h.navigateByUrl('/dashboard/settings/resins');
    expect(url()).toBe('/dashboard');
  });

  it('un supervisor entra a Ingresos y egresos pero no a Usuarios', async () => {
    const h = await start('supervisor');
    await h.navigateByUrl('/dashboard/settings/payments-report');
    expect(url()).toBe('/dashboard/settings/payments-report');
    await h.navigateByUrl('/dashboard/settings/users-management');
    expect(url()).toBe('/dashboard');
  });

  it('un megadmin entra a Usuarios', async () => {
    const h = await start('megadmin');
    await h.navigateByUrl('/dashboard/settings/users-management');
    expect(url()).toBe('/dashboard/settings/users-management');
  });

  it('una ruta inexistente muestra la página 404', async () => {
    const h = await start(null);
    await h.navigateByUrl('/no-existe');
    expect(text(h)).toContain('Página no encontrada');
  });
});
