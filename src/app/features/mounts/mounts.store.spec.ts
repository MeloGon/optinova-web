import { TestBed } from '@angular/core/testing';
import { appError } from '../../core/errors/app-error';
import { AuditLogRepository } from '../../core/repositories/audit-log.repository';
import { MountRepository } from '../../core/repositories/mount.repository';
import { FakeAuditLogRepository } from '../../testing/fake-audit-log.repository';
import { FakeMountRepository, fakeMount } from '../../testing/fake-mount.repository';
import { MountsStore } from './mounts.store';

describe('MountsStore', () => {
  let repo: FakeMountRepository;
  let auditLog: FakeAuditLogRepository;
  let store: MountsStore;

  beforeEach(() => {
    repo = new FakeMountRepository();
    repo.mounts = [
      { ...fakeMount(1, 'RAY-BAN', 5), price: 300, branch: 'OFTALVISION' },
      { ...fakeMount(2, 'OAKLEY', 1), price: 400, branch: 'MEDILENT' },
      { ...fakeMount(3, 'VOGUE', 0), price: 250, branch: 'OFTALVISION' },
    ];
    auditLog = new FakeAuditLogRepository();
    TestBed.configureTestingModule({
      providers: [
        MountsStore,
        { provide: MountRepository, useValue: repo },
        { provide: AuditLogRepository, useValue: auditLog },
      ],
    });
    store = TestBed.inject(MountsStore);
  });

  it('empieza sin cargar y sin resultados', () => {
    expect(store.loaded()).toBe(false);
    expect(store.items()).toEqual([]);
    expect(store.total()).toBe(0);
  });

  it('carga la página pedida, el total y los contadores por stock (incluye agotados, a diferencia de search)', async () => {
    await store.load({ query: '', branch: null, stockStatus: 'all', page: 1, pageSize: 10 });
    expect(store.total()).toBe(3);
    expect(store.counts()).toEqual({ all: 3, low: 1, out: 1 });
  });

  it('filtra por sucursal y por estado de stock', async () => {
    await store.load({ query: '', branch: 'OFTALVISION', stockStatus: 'out', page: 1, pageSize: 10 });
    expect(store.items().map((m) => m.id)).toEqual(['3']);
  });

  it('un error se guarda como mensaje', async () => {
    repo.searchFailWith = appError('network', 'Sin conexión.');
    await store.load({ query: '', branch: null, stockStatus: 'all', page: 1, pageSize: 10 });
    expect(store.error()).toBe('Sin conexión.');
    expect(store.loaded()).toBe(true);
  });

  it('al crear registra la auditoría y refresca la lista pedida', async () => {
    await store.load({ query: '', branch: null, stockStatus: 'all', page: 1, pageSize: 10 });
    const { id, ...draft } = fakeMount(0, 'NUEVA MARCA');
    void id;

    const result = await store.create(draft, 'admin@optinova.test');

    expect(result.ok).toBe(true);
    expect(store.items().map((m) => m.brand)).toContain('NUEVA MARCA');
    expect(auditLog.logged[0].entry.action).toBe('create_mount');
    expect(auditLog.logged[0].userEmail).toBe('admin@optinova.test');
  });

  it('si crear falla devuelve el error y no cambia la lista', async () => {
    await store.load({ query: '', branch: null, stockStatus: 'all', page: 1, pageSize: 10 });
    repo.insertFailWith = appError('server', 'Falló.');
    const { id, ...draft } = fakeMount(0, 'NUEVA MARCA');
    void id;

    const result = await store.create(draft, 'admin@optinova.test');

    expect(result.ok).toBe(false);
    expect(store.items().length).toBe(3);
    expect(auditLog.logged.length).toBe(0);
  });

  it('al editar guarda en el repositorio, audita y refresca la lista', async () => {
    await store.load({ query: '', branch: null, stockStatus: 'all', page: 1, pageSize: 10 });
    const mount = store.items().find((m) => m.id === '1')!;

    const result = await store.update({ ...mount, color: 'AZUL' }, 'admin@optinova.test');

    expect(result.ok).toBe(true);
    expect(store.items().find((m) => m.id === '1')?.color).toBe('AZUL');
    expect(auditLog.logged[0].entry.action).toBe('update_mount');
  });

  it('al eliminar un armazón que nunca se vendió, lo borra, audita y refresca la lista', async () => {
    await store.load({ query: '', branch: null, stockStatus: 'all', page: 1, pageSize: 10 });
    const mount = store.items().find((m) => m.id === '1')!;

    const result = await store.remove(mount, 'admin@optinova.test');

    expect(result.ok).toBe(true);
    expect(store.items().length).toBe(2);
    expect(auditLog.logged[0].entry.action).toBe('delete_mount');
    expect(auditLog.logged[0].entry.entityId).toBe('1');
  });

  it('si el armazón ya se vendió, lo archiva (no lo borra), lo audita como archivado y sale de la lista', async () => {
    repo.soldIds.add('1');
    await store.load({ query: '', branch: null, stockStatus: 'all', page: 1, pageSize: 10 });
    const mount = store.items().find((m) => m.id === '1')!;

    const result = await store.remove(mount, 'admin@optinova.test');

    expect(result.ok && result.value).toBe('archived');
    expect(store.items().find((m) => m.id === '1')).toBeUndefined();
    expect(auditLog.logged[0].entry.action).toBe('archive_mount');
  });

  it('si la base rechaza la eliminación, devuelve el error y no audita', async () => {
    repo.removeFailWith = { kind: 'server', message: 'Falló.' };
    await store.load({ query: '', branch: null, stockStatus: 'all', page: 1, pageSize: 10 });

    const result = await store.remove(store.items()[0], 'admin@optinova.test');

    expect(result.ok).toBe(false);
    expect(auditLog.logged).toHaveLength(0);
  });
});
