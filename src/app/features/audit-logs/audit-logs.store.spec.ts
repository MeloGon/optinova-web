import { TestBed } from '@angular/core/testing';
import { appError } from '../../core/errors/app-error';
import { AuditLogRepository } from '../../core/repositories/audit-log.repository';
import { FakeAuditLogRepository, fakeAuditLog } from '../../testing/fake-audit-log.repository';
import { AuditLogsStore } from './audit-logs.store';

describe('AuditLogsStore', () => {
  let repo: FakeAuditLogRepository;
  let store: AuditLogsStore;

  beforeEach(() => {
    repo = new FakeAuditLogRepository();
    repo.entries = [
      { ...fakeAuditLog('1', 'create_mount'), entity: 'mount', userEmail: 'admin@optinova.test' },
      { ...fakeAuditLog('2', 'delete_resin'), entity: 'resin', userEmail: 'supervisor@optinova.test' },
    ];
    TestBed.configureTestingModule({
      providers: [AuditLogsStore, { provide: AuditLogRepository, useValue: repo }],
    });
    store = TestBed.inject(AuditLogsStore);
  });

  it('empieza sin cargar y sin resultados', () => {
    expect(store.loaded()).toBe(false);
    expect(store.items()).toEqual([]);
    expect(store.stats()).toBeNull();
  });

  it('carga la página pedida y las estadísticas', async () => {
    await store.load({ query: '', page: 1, pageSize: 10 });
    expect(store.total()).toBe(2);
    expect(store.stats()?.total).toBe(2);
    expect(store.loaded()).toBe(true);
  });

  it('filtra por acción, entidad o usuario', async () => {
    await store.load({ query: 'resin', page: 1, pageSize: 10 });
    expect(store.items().map((e) => e.id)).toEqual(['2']);
  });

  it('un error de búsqueda se guarda como mensaje', async () => {
    repo.searchFailWith = appError('network', 'Sin conexión.');
    await store.load({ query: '', page: 1, pageSize: 10 });
    expect(store.error()).toBe('Sin conexión.');
    expect(store.loaded()).toBe(true);
  });

  it('un registro hecho por otro store (Resinas/Armazones) aparece al recargar', async () => {
    await repo.log({ action: 'create_resin', entity: 'resin', entityId: '9', detail: { descripcion: 'Nueva' } }, 'admin@optinova.test');
    await store.load({ query: '', page: 1, pageSize: 10 });
    expect(store.items()[0].action).toBe('create_resin');
    expect(store.items()[0].entityId).toBe('9');
  });
});
