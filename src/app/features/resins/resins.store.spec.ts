import { TestBed } from '@angular/core/testing';
import { appError } from '../../core/errors/app-error';
import { AuditLogRepository } from '../../core/repositories/audit-log.repository';
import { ResinRepository } from '../../core/repositories/resin.repository';
import { FakeAuditLogRepository } from '../../testing/fake-audit-log.repository';
import { FakeResinRepository, fakeResin } from '../../testing/fake-resin.repository';
import { ResinsStore } from './resins.store';

describe('ResinsStore', () => {
  let repo: FakeResinRepository;
  let auditLog: FakeAuditLogRepository;
  let store: ResinsStore;

  beforeEach(() => {
    repo = new FakeResinRepository();
    repo.resins = [
      { ...fakeResin(1, 'Monofocal CR-39'), price: 100, quantity: 5 },
      { ...fakeResin(2, 'Progresiva poli'), price: 200, quantity: 1 },
      { ...fakeResin(3, 'Bifocal vidrio'), price: 50, quantity: 0 },
    ];
    auditLog = new FakeAuditLogRepository();
    TestBed.configureTestingModule({
      providers: [
        ResinsStore,
        { provide: ResinRepository, useValue: repo },
        { provide: AuditLogRepository, useValue: auditLog },
      ],
    });
    store = TestBed.inject(ResinsStore);
  });

  it('empieza sin cargar y sin resultados', () => {
    expect(store.loaded()).toBe(false);
    expect(store.items()).toEqual([]);
    expect(store.total()).toBe(0);
  });

  it('carga la página pedida, el total y los contadores por stock', async () => {
    await store.load({ query: '', stockStatus: 'all', page: 1, pageSize: 10 });
    expect(store.total()).toBe(3);
    expect(store.counts()).toEqual({ all: 3, low: 1, out: 1 });
    expect(store.loaded()).toBe(true);
  });

  it('filtra por estado de stock', async () => {
    await store.load({ query: '', stockStatus: 'out', page: 1, pageSize: 10 });
    expect(store.items().map((r) => r.id)).toEqual([3]);
  });

  it('un error se guarda como mensaje', async () => {
    repo.searchFailWith = appError('network', 'Sin conexión.');
    await store.load({ query: '', stockStatus: 'all', page: 1, pageSize: 10 });
    expect(store.error()).toBe('Sin conexión.');
    expect(store.loaded()).toBe(true);
  });

  it('al crear registra la auditoría y refresca la lista pedida', async () => {
    await store.load({ query: '', stockStatus: 'all', page: 1, pageSize: 10 });
    const { id, text, ...draft } = fakeResin(0, 'Nueva resina');
    void id;
    void text;

    const result = await store.create(draft, 'admin@optinova.test');

    expect(result.ok).toBe(true);
    expect(store.items().map((r) => r.description)).toContain('Nueva resina');
    expect(auditLog.logged[0].entry.action).toBe('create_resin');
    expect(auditLog.logged[0].userEmail).toBe('admin@optinova.test');
  });

  it('si crear falla devuelve el error y no cambia la lista', async () => {
    await store.load({ query: '', stockStatus: 'all', page: 1, pageSize: 10 });
    repo.insertFailWith = appError('server', 'Falló.');
    const { id, text, ...draft } = fakeResin(0, 'Nueva resina');
    void id;
    void text;

    const result = await store.create(draft, 'admin@optinova.test');

    expect(result.ok).toBe(false);
    expect(store.items().length).toBe(3);
    expect(auditLog.logged.length).toBe(0);
  });

  it('al editar guarda en el repositorio, audita y refresca la lista', async () => {
    await store.load({ query: '', stockStatus: 'all', page: 1, pageSize: 10 });
    const resin = store.items().find((r) => r.id === 1)!;

    const result = await store.update({ ...resin, description: 'Monofocal cambiada' }, 'admin@optinova.test');

    expect(result.ok).toBe(true);
    expect(store.items().find((r) => r.id === 1)?.description).toBe('Monofocal cambiada');
    expect(auditLog.logged[0].entry.action).toBe('update_resin');
  });

  it('al eliminar borra en el repositorio, audita y refresca la lista', async () => {
    await store.load({ query: '', stockStatus: 'all', page: 1, pageSize: 10 });
    const resin = store.items().find((r) => r.id === 1)!;

    const result = await store.remove(resin, 'admin@optinova.test');

    expect(result.ok).toBe(true);
    expect(store.items().length).toBe(2);
    expect(auditLog.logged[0].entry.action).toBe('delete_resin');
    expect(auditLog.logged[0].entry.entityId).toBe('1');
  });
});
