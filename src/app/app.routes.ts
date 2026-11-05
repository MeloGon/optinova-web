import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/auth/guards';
import { PageData } from './core/models/page-data';

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
      {
        path: 'settings/resins',
        title: 'Resinas · Optinova',
        data: {
          title: 'Resinas',
          description: 'Inventario de resinas y sus precios.',
          minRole: 'admin',
        } satisfies PageData,
        canActivate: [roleGuard('admin')],
        loadComponent: () => import('./features/resins/resins.page').then((m) => m.ResinsPage),
      },
      {
        path: 'settings/mounts',
        title: 'Armazones · Optinova',
        data: {
          title: 'Armazones',
          description: 'Inventario de armazones.',
          minRole: 'admin',
        } satisfies PageData,
        canActivate: [roleGuard('admin')],
        loadComponent: () => import('./features/mounts/mounts.page').then((m) => m.MountsPage),
      },
      {
        path: 'settings/payments-report',
        title: 'Ingresos y egresos · Optinova',
        data: {
          title: 'Ingresos y egresos',
          description: 'Reporte de pagos y gastos por periodo.',
          minRole: 'supervisor',
        } satisfies PageData,
        canActivate: [roleGuard('supervisor')],
        loadComponent: () => import('./features/payments-report/payments-report.page').then((m) => m.PaymentsReportPage),
      },
      {
        path: 'settings/sales-by-seller',
        title: 'Ventas por vendedor · Optinova',
        data: {
          title: 'Ventas por vendedor',
          description: 'Ventas agrupadas por vendedor.',
          minRole: 'admin',
        } satisfies PageData,
        canActivate: [roleGuard('admin')],
        loadComponent: () => import('./features/sales-by-seller/sales-by-seller.page').then((m) => m.SalesBySellerPage),
      },
      {
        path: 'settings/sales-by-seller/:name',
        title: 'Ventas por vendedor · Optinova',
        data: {
          title: 'Ventas por vendedor',
          description: 'Ventas de un vendedor en el mes elegido.',
          minRole: 'admin',
        } satisfies PageData,
        canActivate: [roleGuard('admin')],
        loadComponent: () => import('./features/sales-by-seller/seller-sales.page').then((m) => m.SellerSalesPage),
      },
      {
        path: 'settings/features',
        title: 'Funcionalidades · Optinova',
        data: {
          title: 'Funcionalidades',
          description: 'Permisos de vendedores y funciones de la app.',
          minRole: 'supervisor',
        } satisfies PageData,
        canActivate: [roleGuard('supervisor')],
        loadComponent: () => import('./features/app-features/app-features.page').then((m) => m.AppFeaturesPage),
      },
      {
        path: 'settings/users-management',
        title: 'Usuarios · Optinova',
        data: {
          title: 'Usuarios',
          description: 'Crea, edita y desactiva usuarios; restablece su contraseña.',
          minRole: 'megadmin',
        } satisfies PageData,
        canActivate: [roleGuard('megadmin')],
        loadComponent: () => import('./features/users/users.page').then((m) => m.UsersPage),
      },
      {
        path: 'settings/audit-logs',
        title: 'Auditoría · Optinova',
        data: {
          title: 'Auditoría',
          description: 'Historial de cambios en ventas, pagos y catálogo.',
          minRole: 'admin',
        } satisfies PageData,
        canActivate: [roleGuard('admin')],
        loadComponent: () => import('./features/audit-logs/audit-logs.page').then((m) => m.AuditLogsPage),
      },
    ],
  },

  // = errorBuilder: NoPageFoundView
  {
    path: '**',
    title: 'Página no encontrada · Optinova',
    loadComponent: () => import('./shared/pages/not-found.page').then((m) => m.NotFoundPage),
  },
];
