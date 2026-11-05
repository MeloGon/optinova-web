import { TestBed } from '@angular/core/testing';
import { appError } from '../../core/errors/app-error';
import { AppConfigRepository } from '../../core/repositories/app-config.repository';
import { TeamPermissionsRepository } from '../../core/repositories/team-permissions.repository';
import { FakeAppConfigRepository, fakeFeature } from '../../testing/fake-app-config.repository';
import { FakeTeamPermissionsRepository, fakeVendor } from '../../testing/fake-team-permissions.repository';
import { AppFeaturesStore } from './app-features.store';

describe('AppFeaturesStore', () => {
  let repo: FakeAppConfigRepository;
  let teamRepo: FakeTeamPermissionsRepository;
  let store: AppFeaturesStore;

  beforeEach(() => {
    repo = new FakeAppConfigRepository();
    repo.features = [fakeFeature('feature_change_date', true, 'Permite cambiar la fecha de una venta')];
    teamRepo = new FakeTeamPermissionsRepository();
    teamRepo.vendors = [fakeVendor('v1', 'Vendedor Prueba', 'MEDILENT')];
    TestBed.configureTestingModule({
      providers: [
        AppFeaturesStore,
        { provide: AppConfigRepository, useValue: repo },
        { provide: TeamPermissionsRepository, useValue: teamRepo },
      ],
    });
    store = TestBed.inject(AppFeaturesStore);
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
});
