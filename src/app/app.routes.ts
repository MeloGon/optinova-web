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
      {
        path: 'search-patient',
        title: 'Buscar paciente · Optinova',
        data: {
          title: 'Buscar paciente',
          description: 'Busca y gestiona los registros de pacientes.',
        } satisfies PageData,
        loadComponent: () =>
          import('./features/search-patient/search-patient.page').then((m) => m.SearchPatientPage),
      },
      {
        path: 'search-patient/:id',
        title: 'Paciente · Optinova',
        data: {
          title: 'Paciente',
          description: 'Ficha del paciente: revisiones, ventas y pagos.',
        } satisfies PageData,
        loadComponent: () =>
          import('./features/search-patient/patient-detail.page').then((m) => m.PatientDetailPage),
      },
      {
        path: 'expenses',
        title: 'Egresos · Optinova',
        data: {
          title: 'Egresos',
          description: 'Registra y consulta los gastos de la sucursal.',
        } satisfies PageData,
        loadComponent: () => import('./features/expenses/expenses.page').then((m) => m.ExpensesPage),
      },
      {
        path: 'sales-history',
        title: 'Historial de ventas · Optinova',
        data: {
          title: 'Historial de ventas',
          description: 'Consulta y filtra las ventas registradas.',
        } satisfies PageData,
        loadComponent: () =>
          import('./features/sales-history/sales-history.page').then((m) => m.SalesHistoryPage),
      },
      {
        path: 'sell',
        title: 'Nueva venta · Optinova',
        data: {
          title: 'Nueva venta',
          description: 'Registra una venta en 3 pasos.',
        } satisfies PageData,
        loadComponent: () => import('./features/sell/sell.page').then((m) => m.SellPage),
      },
      {
        path: 'settings/appearance',
        title: 'Apariencia · Optinova',
        data: {
          title: 'Apariencia',
          description: 'Color primario, tema y densidad de la interfaz.',
        } satisfies PageData,
        loadComponent: () =>
          import('./features/appearance/appearance.page').then((m) => m.AppearancePage),
      },
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
