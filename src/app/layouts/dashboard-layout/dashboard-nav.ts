import {
  LucideChartColumn,
  LucideGlasses,
  LucideHandCoins,
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
} from '@lucide/angular';
import { Role } from '../../core/models/role';
import { NavItem, NavSection } from '../../shared/ui/sidebar/sidebar';

export interface DashboardNavItem extends NavItem {
  /** Rol mínimo; debe coincidir con `data.minRole` de la ruta (lo revisa un test). */
  minRole: Role;
}

export interface DashboardNavSection extends NavSection {
  items: DashboardNavItem[];
}

/**
 * Menú lateral (C-20). Rutas iguales a RouterName de Flutter; permisos iguales a los
 * de su página "Configuración". Una sección sin ítems visibles no se muestra.
 */
export const DASHBOARD_NAV: DashboardNavSection[] = [
  {
    title: 'Menú',
    items: [
      { label: 'Dashboard', icon: LucideLayoutDashboard, path: '/dashboard', exact: true, minRole: 'vendedor' },
      { label: 'Buscar paciente', icon: LucideSearch, path: '/dashboard/search-patient', minRole: 'vendedor' },
      { label: 'Agregar paciente', icon: LucideUserPlus, path: '/dashboard/add-patient', minRole: 'vendedor' },
      { label: 'Nueva venta', icon: LucideShoppingCart, path: '/dashboard/sell', minRole: 'vendedor' },
      { label: 'Historial de ventas', icon: LucideReceipt, path: '/dashboard/sales-history', minRole: 'vendedor' },
      { label: 'Egresos', icon: LucideWallet, path: '/dashboard/expenses', minRole: 'vendedor' },
    ],
  },
  {
    title: 'Inventario',
    items: [
      { label: 'Resinas', icon: LucideGlasses, path: '/dashboard/settings/resins', minRole: 'admin' },
      { label: 'Armazones', icon: LucideScanEye, path: '/dashboard/settings/mounts', minRole: 'admin' },
    ],
  },
  {
    title: 'Reportes',
    items: [
      {
        label: 'Ingresos y egresos',
        icon: LucideHandCoins,
        path: '/dashboard/settings/payments-report',
        minRole: 'supervisor',
      },
      {
        label: 'Ventas por vendedor',
        icon: LucideChartColumn,
        path: '/dashboard/settings/sales-by-seller',
        minRole: 'admin',
      },
    ],
  },
  {
    title: 'Administración',
    items: [
      { label: 'Funcionalidades', icon: LucideSlidersHorizontal, path: '/dashboard/settings/features', minRole: 'admin' },
      { label: 'Auditoría', icon: LucideShieldCheck, path: '/dashboard/settings/audit-logs', minRole: 'admin' },
    ],
  },
  {
    title: 'Súper administración',
    items: [
      { label: 'Usuarios', icon: LucideUsers, path: '/dashboard/settings/users-management', minRole: 'megadmin' },
    ],
  },
];
