import { TestBed } from '@angular/core/testing';
import { FakeSupabase } from '../../testing/fake-supabase';
import { ResinRepository } from '../repositories/resin.repository';
import { SupabaseResinRepository } from './supabase-resin.repository';

describe('SupabaseResinRepository', () => {
  let fake: FakeSupabase;
  let repo: ResinRepository;

  beforeEach(() => {
    fake = new FakeSupabase();
    TestBed.configureTestingModule({
      providers: [fake.provider(), { provide: ResinRepository, useClass: SupabaseResinRepository }],
    });
    repo = TestBed.inject(ResinRepository);
  });

  describe('resinas archivadas', () => {
    it('el catálogo de Vender, el inventario y los contadores las dejan fuera', async () => {
      fake.enqueue({ data: [], count: 0 }).enqueue({ data: [], count: 0 });
      fake.enqueue({ data: null, count: 0 }).enqueue({ data: null, count: 0 }).enqueue({ data: null, count: 0 });

      await repo.search({ query: '', page: 1, pageSize: 10 });
      await repo.listInventory({ query: '', stockStatus: 'all', page: 1, pageSize: 10 });
      await repo.countByStock({ query: '' });

      expect(fake.queries).toHaveLength(5);
      for (const query of fake.queries) expect(query.of('is')).toContainEqual(['archivado_en', null]);
    });
  });

  describe('remove', () => {
    it('llama a remove_resin y devuelve "archived" si ya se vendió', async () => {
      fake.enqueue({ data: 'archived' });
      const result = await repo.remove(5);

      expect(fake.queries[0].table).toBe('rpc:remove_resin');
      expect(fake.queries[0].first('rpc')?.[0]).toEqual({ p_id: 5 });
      expect(result).toEqual({ ok: true, value: 'archived' });
    });

    it('devuelve "deleted" si nunca se vendió', async () => {
      fake.enqueue({ data: 'deleted' });
      expect(await repo.remove(5)).toEqual({ ok: true, value: 'deleted' });
    });

    it('si la base falla, devuelve el error', async () => {
      fake.enqueue({ error: { message: 'La resina ya no existe o no tienes permiso para eliminarla.', code: 'P0002' } });
      const result = await repo.remove(5);

      expect(result).toEqual({
        ok: false,
        error: { kind: 'server', message: 'La resina ya no existe o no tienes permiso para eliminarla.' },
      });
    });
  });
});
