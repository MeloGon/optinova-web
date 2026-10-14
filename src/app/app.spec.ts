import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';

describe('Rutas', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes, withComponentInputBinding())],
    });
    harness = await RouterTestingHarness.create();
  });

  const text = () => (harness.routeNativeElement as HTMLElement).textContent ?? '';

  it('la raíz manda al login', async () => {
    await harness.navigateByUrl('/');
    expect(TestBed.inject(Router).url).toBe('/auth/login');
    expect(text()).toContain('Inicia sesión');
  });

  it('una página pendiente muestra su título en el topbar y su entregable', async () => {
    await harness.navigateByUrl('/dashboard/sell');
    expect(text()).toContain('Nueva venta');
    expect(text()).toContain('Sigue los pasos para registrar una venta.');
    expect(text()).toContain('E2.6');
  });

  it('una ruta inexistente muestra la página 404', async () => {
    await harness.navigateByUrl('/no-existe');
    expect(text()).toContain('Página no encontrada');
  });
});
