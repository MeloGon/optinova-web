import { TestBed } from '@angular/core/testing';
import { FakeSupabase } from '../../testing/fake-supabase';
import { PaymentRepository } from '../repositories/payment.repository';
import { SupabasePaymentRepository } from './supabase-payment.repository';

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 7,
  id_remision: '99',
  monto: '150.50',
  fecha_pago: '2026-11-05',
  metodo_pago: 'efectivo',
  notas: 'Abono',
  tipo_pago: 'abono_saldo',
  perfiles: { nombre: 'Ana Pérez' },
  ...overrides,
});

describe('SupabasePaymentRepository', () => {
  let fake: FakeSupabase;
  let repo: PaymentRepository;

  beforeEach(() => {
    fake = new FakeSupabase();
    TestBed.configureTestingModule({
      providers: [fake.provider(), { provide: PaymentRepository, useClass: SupabasePaymentRepository }],
    });
    repo = TestBed.inject(PaymentRepository);
  });

  describe('listBySale', () => {
    it('mapea la fila: monto a número y nombre de quien registró', async () => {
      fake.enqueue({ data: [row()] });
      const result = await repo.listBySale('99');

      expect(result).toEqual({
        ok: true,
        value: [
          {
            id: 7,
            saleId: '99',
            amount: 150.5,
            date: '2026-11-05',
            paymentMethod: 'efectivo',
            registeredBy: 'Ana Pérez',
            notes: 'Abono',
            type: 'abono_saldo',
          },
        ],
      });
    });

    it('con campos nulos usa valores vacíos y trata el tipo desconocido como abono', async () => {
      fake.enqueue({ data: [row({ metodo_pago: null, notas: null, tipo_pago: null, perfiles: null })] });
      const result = await repo.listBySale('99');

      expect(result.ok && result.value[0]).toMatchObject({
        paymentMethod: '',
        notes: '',
        registeredBy: '',
        type: 'abono_saldo',
      });
    });

    it('reconoce el pago inicial de la venta', async () => {
      fake.enqueue({ data: [row({ tipo_pago: 'nueva_venta' })] });
      const result = await repo.listBySale('99');

      expect(result.ok && result.value[0].type).toBe('nueva_venta');
    });

    it('filtra por la venta y ordena del más viejo al más nuevo con desempate por id', async () => {
      fake.enqueue({ data: [] });
      await repo.listBySale('99');

      const query = fake.queries[0];
      expect(query.table).toBe('pagos');
      expect(query.first('eq')).toEqual(['id_remision', '99']);
      expect(query.of('order')).toEqual([
        ['fecha_pago', { ascending: true }],
        ['id', { ascending: true }],
      ]);
    });

    it('un error de la base se devuelve como AppError, no se lanza', async () => {
      fake.enqueue({ error: { message: 'permission denied', code: '42501' } });
      const result = await repo.listBySale('99');

      expect(result).toEqual({ ok: false, error: { kind: 'unauthorized', message: 'permission denied' } });
    });
  });

  describe('listByPatient', () => {
    it('embebe la venta con !inner y filtra por el paciente de la venta', async () => {
      fake.enqueue({ data: [row()] });
      await repo.listByPatient('12345678901234567');

      const query = fake.queries[0];
      expect(String(query.first('select')?.[0])).toContain('ventas!inner(paciente_id)');
      expect(query.first('eq')).toEqual(['ventas.paciente_id', '12345678901234567']);
    });

    it('ordena del más nuevo al más viejo', async () => {
      fake.enqueue({ data: [] });
      await repo.listByPatient('1');

      expect(fake.queries[0].of('order')).toEqual([
        ['fecha_pago', { ascending: false }],
        ['id', { ascending: false }],
      ]);
    });
  });

  describe('create', () => {
    const payment = {
      saleId: '99',
      amount: 80,
      date: '2026-11-05',
      paymentMethod: 'yape',
      notes: '',
      type: 'abono_saldo' as const,
    };

    it('inserta con los nombres de columna de la base y quién lo registró', async () => {
      fake.enqueue({ data: row({ monto: 80, metodo_pago: 'yape' }) });
      const result = await repo.create(payment, 'user-1');

      expect(fake.queries[0].table).toBe('pagos');
      expect(fake.queries[0].first('insert')?.[0]).toEqual({
        id_remision: '99',
        monto: 80,
        fecha_pago: '2026-11-05',
        metodo_pago: 'yape',
        notas: null,
        tipo_pago: 'abono_saldo',
        registrado_por: 'user-1',
      });
      expect(result.ok && result.value.amount).toBe(80);
    });

    it('guarda las notas cuando hay, y null cuando vienen vacías', async () => {
      fake.enqueue({ data: row() }).enqueue({ data: row() });
      await repo.create({ ...payment, notes: 'Pago inicial de venta' }, 'user-1');
      await repo.create({ ...payment, notes: '' }, 'user-1');

      expect((fake.queries[0].first('insert')?.[0] as { notas: unknown }).notas).toBe('Pago inicial de venta');
      expect((fake.queries[1].first('insert')?.[0] as { notas: unknown }).notas).toBeNull();
    });

    it('si la base rechaza el insert, devuelve el error', async () => {
      fake.enqueue({ error: { message: 'violates foreign key', code: '23503' } });
      const result = await repo.create(payment, 'user-1');

      expect(result).toEqual({ ok: false, error: { kind: 'server', message: 'violates foreign key' } });
    });
  });
});
