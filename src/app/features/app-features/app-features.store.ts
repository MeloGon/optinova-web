import { Injectable, computed, inject, signal } from '@angular/core';
import { SessionStore } from '../../core/auth/session.store';
import { ConfigService } from '../../core/config/config.service';
import { TeamVendor } from '../../core/models/team-vendor';
import { AppConfigRepository } from '../../core/repositories/app-config.repository';
import { BranchSettingsRepository } from '../../core/repositories/branch-settings.repository';
import { TeamPermissionsRepository } from '../../core/repositories/team-permissions.repository';

interface AppFeaturesState {
  features: { key: string; value: boolean; description: string }[];
  loading: boolean;
  savingKey: string | null;
  /** Mensaje para el usuario; null si no hay error. */
  error: string | null;
  /** Falso hasta que llega la primera respuesta: distingue "cargando" de "sin funciones". */
  loaded: boolean;

  vendors: TeamVendor[];
  vendorsLoading: boolean;
  savingVendorId: string | null;
  vendorsError: string | null;
  vendorsLoaded: boolean;

  /** Sucursales (por nombre) donde un vendedor necesita autorización de supervisor para descontar. */
  discountAuthBranches: string[];
  savingBranch: string | null;
  branchesError: string | null;
  branchesLoaded: boolean;
}

/** Una fila de la sección "Descuentos": una sucursal que el usuario puede administrar. */
export interface DiscountBranchRow {
  branch: string;
  requiresAuth: boolean;
}

/**
 * Estado de Settings · Features (= AppFeaturesNotifier de Flutter, con dos secciones):
 * 1. Interruptores generales de `app_config` (apagado de emergencia para toda la empresa; solo
 *    admin+ puede cambiarlos, RLS del cambio #21).
 * 2. Permiso "Cambiar fecha de venta" por vendedor (`puede_cambiar_fecha`): un supervisor
 *    administra solo a los vendedores de su propia sucursal; admin/megadmin, a cualquiera.
 *    El alcance real lo decide el servidor (`list_team_vendors` / `set_vendor_change_date_permission`),
 *    esto es solo para no mostrar controles que el servidor de todos modos va a rechazar.
 * Se provee en la página (providers: [AppFeaturesStore]).
 */
@Injectable()
export class AppFeaturesStore {
  private readonly repo = inject(AppConfigRepository);
  private readonly teamRepo = inject(TeamPermissionsRepository);
  private readonly branchRepo = inject(BranchSettingsRepository);
  private readonly session = inject(SessionStore);
  private readonly activeBranches = inject(ConfigService).activeBranches;

  private readonly state = signal<AppFeaturesState>({
    features: [],
    loading: false,
    savingKey: null,
    error: null,
    loaded: false,

    vendors: [],
    vendorsLoading: false,
    savingVendorId: null,
    vendorsError: null,
    vendorsLoaded: false,

    discountAuthBranches: [],
    savingBranch: null,
    branchesError: null,
    branchesLoaded: false,
  });

  readonly features = computed(() => this.state().features);
  readonly loading = computed(() => this.state().loading);
  readonly savingKey = computed(() => this.state().savingKey);
  readonly error = computed(() => this.state().error);
  readonly loaded = computed(() => this.state().loaded);

  readonly vendors = computed(() => this.state().vendors);
  readonly vendorsLoading = computed(() => this.state().vendorsLoading);
  readonly savingVendorId = computed(() => this.state().savingVendorId);
  readonly vendorsError = computed(() => this.state().vendorsError);
  readonly vendorsLoaded = computed(() => this.state().vendorsLoaded);

  readonly savingBranch = computed(() => this.state().savingBranch);
  readonly branchesError = computed(() => this.state().branchesError);
  readonly branchesLoaded = computed(() => this.state().branchesLoaded);
  /**
   * Sucursales que puede administrar quien mira: el supervisor, solo la suya; admin/megadmin,
   * todas las activas. El servidor (`set_branch_discount_auth`) vuelve a validarlo.
   */
  readonly discountBranches = computed<DiscountBranchRow[]>(() => {
    const required = this.state().discountAuthBranches;
    const own = this.session.profile()?.branch ?? '';
    const names = this.session.can('admin') ? this.activeBranches().map((b) => b.value) : own ? [own] : [];
    return names.map((branch) => ({ branch, requiresAuth: required.includes(branch) }));
  });

  async load(): Promise<void> {
    this.state.update((s) => ({ ...s, loading: true, error: null }));
    const result = await this.repo.list();
    if (result.ok) {
      this.state.update((s) => ({ ...s, features: result.value, loading: false, loaded: true }));
    } else {
      this.state.update((s) => ({ ...s, loading: false, error: result.error.message, loaded: true }));
    }
  }

  /** Optimista (= el `copyWith` inmediato de Flutter), revierte si el servidor la rechaza. */
  async toggle(key: string, value: boolean): Promise<void> {
    this.state.update((s) => ({
      ...s,
      savingKey: key,
      error: null,
      features: s.features.map((f) => (f.key === key ? { ...f, value } : f)),
    }));

    const result = await this.repo.setValue(key, value);
    this.state.update((s) => ({
      ...s,
      savingKey: null,
      error: result.ok ? null : result.error.message,
      features: result.ok ? s.features : s.features.map((f) => (f.key === key ? { ...f, value: !value } : f)),
    }));
  }

  async loadVendors(): Promise<void> {
    this.state.update((s) => ({ ...s, vendorsLoading: true, vendorsError: null }));
    const result = await this.teamRepo.listVendors();
    if (result.ok) {
      this.state.update((s) => ({ ...s, vendors: result.value, vendorsLoading: false, vendorsLoaded: true }));
    } else {
      this.state.update((s) => ({ ...s, vendorsLoading: false, vendorsError: result.error.message, vendorsLoaded: true }));
    }
  }

  async toggleVendor(vendorId: string, value: boolean): Promise<void> {
    this.state.update((s) => ({
      ...s,
      savingVendorId: vendorId,
      vendorsError: null,
      vendors: s.vendors.map((v) => (v.id === vendorId ? { ...v, canChangeDate: value } : v)),
    }));

    const result = await this.teamRepo.setChangeDatePermission(vendorId, value);
    this.state.update((s) => ({
      ...s,
      savingVendorId: null,
      vendorsError: result.ok ? null : result.error.message,
      vendors: result.ok
        ? s.vendors
        : s.vendors.map((v) => (v.id === vendorId ? { ...v, canChangeDate: !value } : v)),
    }));
  }

  async loadBranches(): Promise<void> {
    this.state.update((s) => ({ ...s, branchesError: null }));
    const result = await this.branchRepo.list();
    if (result.ok) {
      const required = result.value.filter((b) => b.discountRequiresAuth).map((b) => b.branch);
      this.state.update((s) => ({ ...s, discountAuthBranches: required, branchesLoaded: true }));
    } else {
      this.state.update((s) => ({ ...s, branchesError: result.error.message, branchesLoaded: true }));
    }
  }

  async toggleBranchDiscountAuth(branch: string, value: boolean): Promise<void> {
    const withValue = (list: string[], on: boolean) =>
      on ? (list.includes(branch) ? list : [...list, branch]) : list.filter((b) => b !== branch);

    this.state.update((s) => ({
      ...s,
      savingBranch: branch,
      branchesError: null,
      discountAuthBranches: withValue(s.discountAuthBranches, value),
    }));

    const result = await this.branchRepo.setDiscountRequiresAuth(branch, value);
    this.state.update((s) => ({
      ...s,
      savingBranch: null,
      branchesError: result.ok ? null : result.error.message,
      discountAuthBranches: result.ok ? s.discountAuthBranches : withValue(s.discountAuthBranches, !value),
    }));
  }
}
