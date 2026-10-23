import { Route, Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/auth/guards';
import { PageData } from './core/models/page-data';

/**
 * Página de una feature que todavía no existe: muestra "En construcción".
 * Si la página pide un rol (data.minRole), se protege con roleGuard.
 */
function pending(path: string, data: PageData & { delivery: string }): Route {
  return {
    path,
    title: `${data.title} · Optinova`,
    data,
    canActivate: data.minRole ? [roleGuard(data.minRole)] : [],
    loadComponent: () => import('./shared/pages/coming-soon.page').then((m) => m.ComingSoonPage),
  };
}

// = el GoRouter de app_router.dart. Mismas rutas que RouterName de Flutter.
export const routes: Routes = [
  // La raíz va al dashboard; sin sesión, authGuard manda al login.
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },

  // = ShellRoute(builder: AuthLayout)
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadComponent: () => import('./layouts/auth-layout/auth-layout').then((m) => m.AuthLayout),
    children: [
      {
        path: 'login',
        title: 'Inicia sesión · Optinova',
        loadComponent: () => import('./features/login/login.page').then((m) => m.LoginPage),
      },
    ],
  },

  // = StatefulShellRoute(builder: DashboardLayout)
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layouts/dashboard-layout/dashboard-layout').then((m) => m.DashboardLayout),
    children: [
      {
        path: '',
        title: 'Dashboard · Optinova',
        data: { title: 'Dashboard', description: 'Resumen de tu sucursal.' } satisfies PageData,
        loadComponent: () =>
          import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      pending('search-patient', {
        title: 'Buscar paciente',
        description: 'Busca y gestiona los registros de pacientes.',
        delivery: 'E2.2',
      }),
      pending('add-patient', {
        title: 'Agregar paciente',
        description: 'Registra un paciente nuevo y su revisión.',
        delivery: 'E2.3',
      }),
      pending('expenses', {
        title: 'Egresos',
        description: 'Registra y consulta los gastos de la sucursal.',
        delivery: 'E2.4',
      }),
      pending('sales-history', {
        title: 'Historial de ventas',
        description: 'Consulta y filtra las ventas registradas.',
        delivery: 'E2.5',
      }),
      pending('sell', {
        title: 'Nueva venta',
        description: 'Sigue los pasos para registrar una venta.',
        delivery: 'E2.6',
      }),
      pending('settings/resins', {
        minRole: 'admin',
        title: 'Resinas',
        description: 'Inventario de resinas y sus precios.',
        delivery: 'E2.8',
      }),
      pending('settings/mounts', {
        minRole: 'admin',
        title: 'Armazones',
        description: 'Inventario de armazones.',
        delivery: 'E2.8',
      }),
      pending('settings/payments-report', {
        minRole: 'supervisor',
        title: 'Ingresos y egresos',
        description: 'Reporte de pagos y gastos por periodo.',
        delivery: 'E2.8',
      }),
      pending('settings/sales-by-seller', {
        minRole: 'admin',
        title: 'Ventas por vendedor',
        description: 'Ventas agrupadas por vendedor.',
        delivery: 'E2.8',
      }),
      pending('settings/features', {
        minRole: 'admin',
        title: 'Funcionalidades',
        description: 'Activa o desactiva funciones de la app.',
        delivery: 'E2.8',
      }),
      pending('settings/users-management', {
        minRole: 'megadmin',
        title: 'Usuarios',
        description: 'Crea y administra los usuarios del sistema.',
        delivery: 'E2.8',
      }),
      pending('settings/audit-logs', {
        minRole: 'admin',
        title: 'Auditoría',
        description: 'Historial de cambios en ventas y pagos.',
        delivery: 'E2.8',
      }),
    ],
  },

  // = errorBuilder: NoPageFoundView
  {
    path: '**',
    title: 'Página no encontrada · Optinova',
    loadComponent: () => import('./shared/pages/not-found.page').then((m) => m.NotFoundPage),
  },
];
