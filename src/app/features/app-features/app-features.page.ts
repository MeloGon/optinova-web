import { Component, inject } from '@angular/core';
import { LucideDynamicIcon, LucideRefreshCw, LucideSlidersHorizontal, LucideTriangleAlert, LucideUsers } from '@lucide/angular';
import { SessionStore } from '../../core/auth/session.store';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { Switch } from '../../shared/ui/switch/switch';
import { AppFeaturesStore } from './app-features.store';

/**
 * Settings · Features (= FeaturesView de Flutter, con dos secciones):
 * - "Funciones generales": interruptores de `app_config` (apagado de emergencia para toda la
 *   empresa). Solo visible y editable para admin+ (RLS, cambio #21); un supervisor no ve esta
 *   sección aunque entre a la página.
 * - "Permisos de vendedores": quién puede cambiar la fecha de una venta. Un supervisor administra
 *   solo a los vendedores de su propia sucursal; admin/megadmin, a cualquiera. Ruta abierta desde
 *   supervisor (antes era solo admin+).
 */
@Component({
  selector: 'app-app-features-page',
  imports: [LucideDynamicIcon, EmptyState, Skeleton, Switch],
  providers: [AppFeaturesStore],
  templateUrl: './app-features.page.html',
})
export class AppFeaturesPage {
  protected readonly store = inject(AppFeaturesStore);
  protected readonly session = inject(SessionStore);

  protected readonly isAdmin = this.session.can('admin');

  protected readonly icons = {
    features: LucideSlidersHorizontal,
    alert: LucideTriangleAlert,
    retry: LucideRefreshCw,
    team: LucideUsers,
  };

  protected readonly skeletonRows = [0, 1];

  constructor() {
    if (this.isAdmin) void this.store.load();
    void this.store.loadVendors();
  }

  protected retry(): void {
    void this.store.load();
  }

  protected toggle(key: string, next: boolean): void {
    void this.store.toggle(key, next);
  }

  protected retryVendors(): void {
    void this.store.loadVendors();
  }

  protected toggleVendor(vendorId: string, next: boolean): void {
    void this.store.toggleVendor(vendorId, next);
  }
}
