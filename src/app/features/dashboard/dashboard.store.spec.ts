import { TestBed } from '@angular/core/testing';
import { DashboardRepository } from '../../core/repositories/dashboard.repository';
import {
  FakeDashboardRepository,
  failWith,
  fakeActivity,
  fakeAdminSummary,
} from '../../testing/fake-dashboard.repository';
import { ok } from '../../core/result';
import { DashboardStore } from './dashboard.store';

describe('DashboardStore', () => {
  let repo: FakeDashboardRepository;
  let store: DashboardStore;

  beforeEach(() => {
    repo = new FakeDashboardRepository();
    TestBed.configureTestingModule({
      providers: [DashboardStore, { provide: DashboardRepository, useValue: repo }],
    });
    store = TestBed.inject(DashboardStore);
  });

  it('empieza sin cargar', () => {
    expect(store.summary()).toBeNull();
    expect(store.loaded()).toBe(false);
  });

  it('carga el resumen que devuelve el servidor, tal cual', async () => {
    await store.loadSummary();
    expect(store.summary()?.role).toBe('vendedor');
    expect(store.summary()?.kpis.incomeToday).toBeNull();
    expect(store.loaded()).toBe(true);
    expect(store.error()).toBeNull();
  });

  it('pasa la sucursal elegida al repositorio', async () => {
    await store.loadSummary('MEDILENT');
    expect(repo.summaryCalls).toEqual(['MEDILENT']);
  });

  it('un error queda en el estado y se limpia al reintentar con éxito', async () => {
    repo.summaryResult = failWith('Sin conexión');
    await store.loadSummary();
    expect(store.error()).toBe('Sin conexión');
    expect(store.summary()).toBeNull();
    expect(store.loaded()).toBe(true);

    repo.summaryResult = ok(fakeAdminSummary());
    await store.loadSummary();
    expect(store.error()).toBeNull();
    expect(store.summary()?.role).toBe('admin');
  });

  it('una respuesta vieja no pisa a una más nueva', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const first = fakeAdminSummary();
    const second = { ...fakeAdminSummary(), branch: 'MEDILENT' };

    repo.summary = async (branch) => {
      repo.summaryCalls.push(branch);
      if (branch === null) {
        await gate; // la primera petición tarda más
        return ok(first);
      }
      return ok(second);
    };

    const slow = store.loadSummary(null);
    await store.loadSummary('MEDILENT');
    release();
    await slow;

    expect(store.summary()?.branch).toBe('MEDILENT');
  });

  it('weekTotal suma las ventas de los 7 días', async () => {
    repo.summaryResult = ok(fakeAdminSummary());
    await store.loadSummary();
    // fakeAdminSummary: totales 0,100,...,600
    expect(store.weekTotal()).toBe(2100);
  });

  it('la actividad carga aparte y su error no tumba el resumen', async () => {
    await store.loadSummary();
    repo.activityResult = failWith('Solo un administrador o superior puede ver la actividad');
    await store.loadActivity();

    expect(store.activityError()).toContain('administrador');
    expect(store.activityLoaded()).toBe(true);
    expect(store.summary()).not.toBeNull();
    expect(store.error()).toBeNull();
  });

  it('guarda la actividad cuando el servidor la entrega', async () => {
    repo.activityResult = ok([fakeActivity()]);
    await store.loadActivity();
    expect(store.activity()).toHaveLength(1);
    expect(store.activityError()).toBeNull();
  });
});
