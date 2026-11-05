import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { SessionStore } from './core/auth/session.store';
import { Role } from './core/models/role';
import { AuthRepository } from './core/repositories/auth.repository';
import { DashboardRepository } from './core/repositories/dashboard.repository';
import { AppConfigRepository } from './core/repositories/app-config.repository';
import { PaymentRepository } from './core/repositories/payment.repository';
import { PaymentsReportRepository } from './core/repositories/payments-report.repository';
import { SaleRepository } from './core/repositories/sale.repository';
import { TeamPermissionsRepository } from './core/repositories/team-permissions.repository';
import { UserAdminRepository } from './core/repositories/user-admin.repository';
import { FakeAppConfigRepository } from './testing/fake-app-config.repository';
import { FakeTeamPermissionsRepository } from './testing/fake-team-permissions.repository';
import { FakeAuthRepository, fakeProfile } from './testing/fake-auth.repository';
import { FakeDashboardRepository } from './testing/fake-dashboard.repository';
import { FakePaymentRepository } from './testing/fake-payment.repository';
import { FakePaymentsReportRepository } from './testing/fake-payments-report.repository';
import { FakeSaleRepository } from './testing/fake-sale.repository';
import { FakeUserAdminRepository } from './testing/fake-user-admin.repository';

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
        // Las redirecciones aterrizan en el dashboard, que pide su resumen al crearse.
        { provide: DashboardRepository, useValue: new FakeDashboardRepository() },
        // El store del dashboard registra abonos con SalePaymentService, que pide estos dos.
        { provide: PaymentRepository, useValue: new FakePaymentRepository() },
        { provide: SaleRepository, useValue: new FakeSaleRepository() },
        // Ingresos y egresos (E2.8) los pide su propio store al entrar.
        { provide: PaymentsReportRepository, useValue: new FakePaymentsReportRepository() },
        // Usuarios (E2.8) lo pide su propio store al entrar.
        { provide: UserAdminRepository, useValue: new FakeUserAdminRepository() },
        // Features (E2.8) y "cambiar fecha" de Historial de ventas leen app_config.
        { provide: AppConfigRepository, useValue: new FakeAppConfigRepository() },
        // Features (E2.8) también lista/administra el permiso por vendedor.
        { provide: TeamPermissionsRepository, useValue: new FakeTeamPermissionsRepository() },
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

  it('admin entra a Funcionalidades; E2.8 ya no tiene páginas pendientes', async () => {
    const h = await start('admin');
    await h.navigateByUrl('/dashboard/settings/features');
    expect(url()).toBe('/dashboard/settings/features');
  });

  it('Apariencia (donde vive el selector de tema) está abierta a todos los roles', async () => {
    const h = await start('vendedor');
    await h.navigateByUrl('/dashboard/settings/appearance');
    expect(url()).toBe('/dashboard/settings/appearance');
    expect(text(h)).toContain('Color primario');
  });

  it('un vendedor no entra a páginas de admin', async () => {
    const h = await start('vendedor');
    await h.navigateByUrl('/dashboard/settings/resins');
    expect(url()).toBe('/dashboard');
  });

  it('un supervisor entra a Ingresos y egresos y a Funcionalidades, pero no a Usuarios', async () => {
    const h = await start('supervisor');
    await h.navigateByUrl('/dashboard/settings/payments-report');
    expect(url()).toBe('/dashboard/settings/payments-report');
    await h.navigateByUrl('/dashboard/settings/features');
    expect(url()).toBe('/dashboard/settings/features');
    await h.navigateByUrl('/dashboard/settings/users-management');
    expect(url()).toBe('/dashboard');
  });

  it('un vendedor no entra a Funcionalidades', async () => {
    const h = await start('vendedor');
    await h.navigateByUrl('/dashboard/settings/features');
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
