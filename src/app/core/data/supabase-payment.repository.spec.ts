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

  describe('register', () => {
    const payment = {
      saleId: '99',
      amount: 80,
      date: '2026-11-05',
      paymentMethod: 'yape',
      notes: '',
      type: 'abono_saldo' as const,
    };

    it('hace UNA sola llamada a register_payment con los nombres de la base (quién lo registró lo pone el servidor)', async () => {
      fake.enqueue({ data: {} });
      const result = await repo.register(payment);

      expect(result).toEqual({ ok: true, value: undefined });
      expect(fake.queries).toHaveLength(1);
      expect(fake.queries[0].table).toBe('rpc:register_payment');
      expect(fake.queries[0].first('rpc')?.[0]).toEqual({
        p_sale_id: '99',
        p_amount: 80,
        p_date: '2026-11-05',
        p_method: 'yape',
        p_notes: null,
        p_type: 'abono_saldo',
      });
    });

    it('manda las notas cuando hay, y null cuando vienen vacías', async () => {
      fake.enqueue({ data: {} }).enqueue({ data: {} });
      await repo.register({ ...payment, notes: 'Pago inicial de venta' });
      await repo.register({ ...payment, notes: '' });

      expect((fake.queries[0].first('rpc')?.[0] as { p_notes: unknown }).p_notes).toBe('Pago inicial de venta');
      expect((fake.queries[1].first('rpc')?.[0] as { p_notes: unknown }).p_notes).toBeNull();
    });

    it('si la base rechaza el abono (p. ej. mayor al saldo), devuelve el error con su mensaje', async () => {
      fake.enqueue({ error: { message: 'El abono (500) supera el saldo pendiente (80.00).', code: '22023' } });
      const result = await repo.register(payment);

      expect(result).toEqual({ ok: false, error: { kind: 'server', message: 'El abono (500) supera el saldo pendiente (80.00).' } });
    });
  });
});
