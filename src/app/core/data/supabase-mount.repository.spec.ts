import { TestBed } from '@angular/core/testing';
import { FakeSupabase } from '../../testing/fake-supabase';
import { MountRepository } from '../repositories/mount.repository';
import { SupabaseMountRepository } from './supabase-mount.repository';

describe('SupabaseMountRepository', () => {
  let fake: FakeSupabase;
  let repo: MountRepository;

  beforeEach(() => {
    fake = new FakeSupabase();
    TestBed.configureTestingModule({
      providers: [fake.provider(), { provide: MountRepository, useClass: SupabaseMountRepository }],
    });
    repo = TestBed.inject(MountRepository);
  });

  describe('armazones archivados', () => {
    it('el catálogo de Vender, el inventario y los contadores los dejan fuera', async () => {
      fake.enqueue({ data: [], count: 0 }).enqueue({ data: [], count: 0 });
      fake.enqueue({ data: null, count: 0 }).enqueue({ data: null, count: 0 }).enqueue({ data: null, count: 0 });

      await repo.search({ query: '', branch: null, page: 1, pageSize: 10 });
      await repo.listInventory({ query: '', branch: null, stockStatus: 'all', page: 1, pageSize: 10 });
      await repo.countByStock({ query: '', branch: null });

      // search, listInventory y las 3 consultas de countByStock.
      expect(fake.queries).toHaveLength(5);
      for (const query of fake.queries) expect(query.of('is')).toContainEqual(['archivado_en', null]);
    });
  });

  describe('remove', () => {
    it('llama a remove_mount y devuelve "archived" si ya se vendió', async () => {
      fake.enqueue({ data: 'archived' });
      const result = await repo.remove('900001');

      expect(fake.queries[0].table).toBe('rpc:remove_mount');
      expect(fake.queries[0].first('rpc')?.[0]).toEqual({ p_id: '900001' });
      expect(result).toEqual({ ok: true, value: 'archived' });
    });

    it('devuelve "deleted" si nunca se vendió', async () => {
      fake.enqueue({ data: 'deleted' });
      expect(await repo.remove('1')).toEqual({ ok: true, value: 'deleted' });
    });

    it('si la base falla (ya no existe o sin permiso), devuelve el error', async () => {
      fake.enqueue({ error: { message: 'El armazón ya no existe o no tienes permiso para eliminarlo.', code: 'P0002' } });
      const result = await repo.remove('1');

      expect(result).toEqual({
        ok: false,
        error: { kind: 'server', message: 'El armazón ya no existe o no tienes permiso para eliminarlo.' },
      });
    });
  });
});
