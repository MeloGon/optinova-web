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

  it('empieza sin cargar, en "hoy" y sin sucursal', () => {
    expect(store.summary()).toBeNull();
    expect(store.loaded()).toBe(false);
    expect(store.period()).toBe('today');
    expect(store.branch()).toBeNull();
  });

  it('carga el resumen que devuelve el servidor, tal cual', async () => {
    await store.load();
    expect(store.summary()?.role).toBe('vendedor');
    expect(store.summary()?.kpis.income).toBeNull();
    expect(store.loaded()).toBe(true);
    expect(store.error()).toBeNull();
  });

  it('pide el resumen con el periodo y la sucursal actuales', async () => {
    await store.load();
    expect(repo.summaryCalls).toEqual([{ branch: null, period: 'today' }]);
  });

  it('cambiar de periodo vuelve a pedir el resumen y conserva la sucursal', async () => {
    await store.setBranch('MEDILENT');
    await store.setPeriod('month');

    expect(store.period()).toBe('month');
    expect(repo.summaryCalls).toEqual([
      { branch: 'MEDILENT', period: 'today' },
      { branch: 'MEDILENT', period: 'month' },
    ]);
  });

  it('cambiar de sucursal conserva el periodo', async () => {
    await store.setPeriod('week');
    await store.setBranch('OFTALVISION');

    expect(repo.summaryCalls.at(-1)).toEqual({ branch: 'OFTALVISION', period: 'week' });
  });

  it('elegir lo que ya estaba elegido no pide de nuevo', async () => {
    await store.setPeriod('today');
    await store.setBranch(null);
    expect(repo.summaryCalls).toEqual([]);
  });

  it('un error queda en el estado y se limpia al reintentar con éxito', async () => {
    repo.summaryResult = failWith('Sin conexión');
    await store.load();
    expect(store.error()).toBe('Sin conexión');
    expect(store.summary()).toBeNull();
    expect(store.loaded()).toBe(true);

    repo.summaryResult = ok(fakeAdminSummary());
    await store.load();
    expect(store.error()).toBeNull();
    expect(store.summary()?.role).toBe('admin');
  });

  it('una respuesta vieja no pisa a una más nueva', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const first = fakeAdminSummary();
    const second = { ...fakeAdminSummary(), branch: 'MEDILENT' };

    repo.summary = async (branch, period) => {
      repo.summaryCalls.push({ branch, period });
      if (branch === null) {
        await gate; // la primera petición tarda más
        return ok(first);
      }
      return ok(second);
    };

    const slow = store.load();
    await store.setBranch('MEDILENT');
    release();
    await slow;

    expect(store.summary()?.branch).toBe('MEDILENT');
  });

  it('chartTotal y chartCount suman lo que dibuja la gráfica', async () => {
    repo.summaryResult = ok(fakeAdminSummary());
    await store.load();
    // fakeAdminSummary: día i → i ventas, i*100 de total (i = 0..6)
    expect(store.chartTotal()).toBe(2100);
    expect(store.chartCount()).toBe(21);
  });

  it('la actividad carga aparte y su error no tumba el resumen', async () => {
    await store.load();
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
