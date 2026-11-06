import { TestBed } from '@angular/core/testing';
import { SessionStore } from '../../core/auth/session.store';
import { appError } from '../../core/errors/app-error';
import { Role } from '../../core/models/role';
import { AppConfigRepository } from '../../core/repositories/app-config.repository';
import { AuthRepository } from '../../core/repositories/auth.repository';
import { BranchSettingsRepository } from '../../core/repositories/branch-settings.repository';
import { TeamPermissionsRepository } from '../../core/repositories/team-permissions.repository';
import { FakeAuthRepository, fakeProfile } from '../../testing/fake-auth.repository';
import { FakeBranchSettingsRepository } from '../../testing/fake-branch-settings.repository';
import { FakeAppConfigRepository, fakeFeature } from '../../testing/fake-app-config.repository';
import { FakeTeamPermissionsRepository, fakeVendor } from '../../testing/fake-team-permissions.repository';
import { AppFeaturesStore } from './app-features.store';

describe('AppFeaturesStore', () => {
  let repo: FakeAppConfigRepository;
  let teamRepo: FakeTeamPermissionsRepository;
  let branchRepo: FakeBranchSettingsRepository;
  let store: AppFeaturesStore;

  async function setup(role: Role = 'admin'): Promise<void> {
    TestBed.resetTestingModule();
    const auth = new FakeAuthRepository();
    auth.session = fakeProfile(role);
    branchRepo = new FakeBranchSettingsRepository();
    TestBed.configureTestingModule({
      providers: [
        AppFeaturesStore,
        { provide: AuthRepository, useValue: auth },
        { provide: AppConfigRepository, useValue: repo },
        { provide: TeamPermissionsRepository, useValue: teamRepo },
        { provide: BranchSettingsRepository, useValue: branchRepo },
      ],
    });
    await TestBed.inject(SessionStore).restore();
    store = TestBed.inject(AppFeaturesStore);
  }

  beforeEach(async () => {
    repo = new FakeAppConfigRepository();
    repo.features = [fakeFeature('feature_change_date', true, 'Permite cambiar la fecha de una venta')];
    teamRepo = new FakeTeamPermissionsRepository();
    teamRepo.vendors = [fakeVendor('v1', 'Vendedor Prueba', 'MEDILENT')];
    await setup();
  });

  it('empieza sin cargar y sin funciones ni vendedores', () => {
    expect(store.loaded()).toBe(false);
    expect(store.features()).toEqual([]);
    expect(store.vendorsLoaded()).toBe(false);
    expect(store.vendors()).toEqual([]);
  });

  it('carga la lista del repositorio', async () => {
    await store.load();
    expect(store.features().map((f) => f.key)).toEqual(['feature_change_date']);
    expect(store.loaded()).toBe(true);
  });

  it('un error se guarda como mensaje', async () => {
    repo.listFailWith = appError('network', 'Sin conexión.');
    await store.load();
    expect(store.error()).toBe('Sin conexión.');
  });

  it('al activar, cambia de inmediato (optimista)', async () => {
    await store.load();
    await store.toggle('feature_change_date', false);
    expect(store.features()[0].value).toBe(false);
  });

  it('si el servidor rechaza el cambio (no es admin+), revierte y avisa', async () => {
    await store.load();
    repo.canWrite = false;

    await store.toggle('feature_change_date', false);

    expect(store.features()[0].value).toBe(true);
    expect(store.error()).toBe('No tienes permiso para cambiar esta función.');
  });

  it('carga la lista de vendedores a cargo', async () => {
    await store.loadVendors();
    expect(store.vendors().map((v) => v.name)).toEqual(['Vendedor Prueba']);
    expect(store.vendorsLoaded()).toBe(true);
  });

  it('un error al cargar vendedores se guarda como mensaje', async () => {
    teamRepo.listFailWith = appError('network', 'Sin conexión.');
    await store.loadVendors();
    expect(store.vendorsError()).toBe('Sin conexión.');
  });

  it('al otorgar el permiso a un vendedor, cambia de inmediato (optimista)', async () => {
    await store.loadVendors();
    await store.toggleVendor('v1', true);
    expect(store.vendors()[0].canChangeDate).toBe(true);
    expect(teamRepo.setCalls).toEqual([{ vendorId: 'v1', value: true }]);
  });

  it('si el servidor rechaza el cambio (otra sucursal), revierte y avisa', async () => {
    await store.loadVendors();
    teamRepo.setFailWith = appError('unauthorized', 'Solo puedes administrar vendedores de tu sucursal');

    await store.toggleVendor('v1', true);

    expect(store.vendors()[0].canChangeDate).toBe(false);
    expect(store.vendorsError()).toBe('Solo puedes administrar vendedores de tu sucursal');
  });

  describe('descuentos por sucursal (P-04)', () => {
    it('admin ve todas las sucursales activas; sin fila, la regla está apagada', async () => {
      await store.loadBranches();
      expect(store.discountBranches().map((b) => b.branch)).toEqual(['OFTALVISION', 'MEDILENT']);
      expect(store.discountBranches().every((b) => !b.requiresAuth)).toBe(true);
    });

    it('supervisor ve solo su propia sucursal', async () => {
      await setup('supervisor');
      branchRepo.settings = [{ branch: 'OFTALVISION', discountRequiresAuth: true }];
      await store.loadBranches();

      expect(store.discountBranches()).toEqual([{ branch: 'OFTALVISION', requiresAuth: true }]);
    });

    it('al activar, cambia de inmediato y llama al servidor', async () => {
      await store.loadBranches();
      await store.toggleBranchDiscountAuth('MEDILENT', true);

      expect(store.discountBranches().find((b) => b.branch === 'MEDILENT')?.requiresAuth).toBe(true);
      expect(branchRepo.setCalls).toEqual([{ branch: 'MEDILENT', value: true }]);
    });

    it('si el servidor rechaza el cambio, revierte y avisa', async () => {
      await store.loadBranches();
      branchRepo.setFailWith = appError('unauthorized', 'Solo puedes administrar tu propia sucursal');

      await store.toggleBranchDiscountAuth('MEDILENT', true);

      expect(store.discountBranches().find((b) => b.branch === 'MEDILENT')?.requiresAuth).toBe(false);
      expect(store.branchesError()).toBe('Solo puedes administrar tu propia sucursal');
    });
  });
});
