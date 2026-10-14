import {
  LucideChartColumn,
  LucideGlasses,
  LucideLayoutDashboard,
  LucideReceipt,
  LucideScanEye,
  LucideSearch,
  LucideShieldCheck,
  LucideShoppingCart,
  LucideSlidersHorizontal,
  LucideUserPlus,
  LucideUsers,
  LucideWallet,
  LucideHandCoins,
} from '@lucide/angular';
import { Role } from '../../core/models/role';
import { NavSection } from '../../shared/ui/sidebar/sidebar';

export interface DashboardNavSection extends NavSection {
  /**
   * Rol mínimo para ver la sección (C-20). Todavía no se aplica: no hay sesión.
   * En E2.1 se filtra y se revisa contra los permisos reales de Flutter.
   */
  minRole: Role;
}

/** Menú lateral (C-20). Las rutas son las mismas de la app Flutter (RouterName). */
export const DASHBOARD_NAV: DashboardNavSection[] = [
  {
    title: 'Menú',
    minRole: 'vendedor',
    items: [
      { label: 'Dashboard', icon: LucideLayoutDashboard, path: '/dashboard', exact: true },
      { label: 'Buscar paciente', icon: LucideSearch, path: '/dashboard/search-patient' },
      { label: 'Agregar paciente', icon: LucideUserPlus, path: '/dashboard/add-patient' },
      { label: 'Nueva venta', icon: LucideShoppingCart, path: '/dashboard/sell' },
      { label: 'Historial de ventas', icon: LucideReceipt, path: '/dashboard/sales-history' },
      { label: 'Egresos', icon: LucideWallet, path: '/dashboard/expenses' },
    ],
  },
  {
    title: 'Inventario',
    minRole: 'admin',
    items: [
      { label: 'Resinas', icon: LucideGlasses, path: '/dashboard/settings/resins' },
      { label: 'Armazones', icon: LucideScanEye, path: '/dashboard/settings/mounts' },
    ],
  },
  {
    title: 'Reportes',
    minRole: 'admin',
    items: [
      { label: 'Ingresos y egresos', icon: LucideHandCoins, path: '/dashboard/settings/payments-report' },
      { label: 'Ventas por vendedor', icon: LucideChartColumn, path: '/dashboard/settings/sales-by-seller' },
    ],
  },
  {
    title: 'Administración',
    minRole: 'admin',
    items: [
      { label: 'Usuarios', icon: LucideUsers, path: '/dashboard/settings/users-management' },
      { label: 'Funcionalidades', icon: LucideSlidersHorizontal, path: '/dashboard/settings/features' },
    ],
  },
  {
    title: 'Súper administración',
    minRole: 'megadmin',
    items: [{ label: 'Auditoría', icon: LucideShieldCheck, path: '/dashboard/settings/audit-logs' }],
  },
];
