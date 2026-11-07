import { TestBed } from '@angular/core/testing';
import { FakeSupabase } from '../../testing/fake-supabase';
import { NewSaleItem } from '../models/sale-item';
import { NewSale, SaleRepository } from '../repositories/sale.repository';
import { SupabaseSaleRepository } from './supabase-sale.repository';

const row = (overrides: Record<string, unknown> = {}) => ({
  id: '10',
  folio: 'F-0010',
  sucursal: 'MEDILENT',
  fecha_actualizada: '2026-11-05',
  paciente_nombre: 'ANA LOPEZ',
  paciente_id: '12345678901234567',
  autor_nombre: 'Vendedor Prueba',
  total: '200.00',
  descuento: '20.00',
  total_con_descuento: '180.00',
  a_cuenta: '50.00',
  resta: '130.00',
  ...overrides,
});

const search = (overrides = {}) => ({ query: '', branch: '', date: '', status: 'all' as const, page: 1, pageSize: 10, ...overrides });

describe('SupabaseSaleRepository', () => {
  let fake: FakeSupabase;
  let repo: SaleRepository;

  beforeEach(() => {
    fake = new FakeSupabase();
    TestBed.configureTestingModule({
      providers: [fake.provider(), { provide: SaleRepository, useClass: SupabaseSaleRepository }],
    });
    repo = TestBed.inject(SaleRepository);
  });

  describe('search', () => {
    it('mapea los montos a números y devuelve el total de la cuenta exacta', async () => {
      fake.enqueue({ data: [row()], count: 42 });
      const result = await repo.search(search());

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.total).toBe(42);
      expect(result.value.items[0]).toEqual({
        id: '10',
        folio: 'F-0010',
        branch: 'MEDILENT',
        date: '2026-11-05',
        patientName: 'ANA LOPEZ',
        patientId: '12345678901234567',
        sellerName: 'Vendedor Prueba',
        total: 200,
        discount: 20,
        totalWithDiscount: 180,
        account: 50,
        rest: 130,
      });
    });

    it('con campos nulos usa valores seguros; sin saldo guardado lo calcula', async () => {
      fake.enqueue({
        data: [row({ folio: null, sucursal: null, descuento: null, total_con_descuento: null, a_cuenta: '30', resta: null })],
      });
      const result = await repo.search(search());

      expect(result.ok && result.value.items[0]).toMatchObject({
        folio: '',
        branch: '',
        discount: 0,
        totalWithDiscount: 200,
        account: 30,
        rest: 170,
      });
    });

    it('el saldo calculado nunca es negativo', async () => {
      fake.enqueue({ data: [row({ total_con_descuento: '100', a_cuenta: '150', resta: null })] });
      const result = await repo.search(search());

      expect(result.ok && result.value.items[0].rest).toBe(0);
    });

    it('sin filtros no agrega condiciones y pide la página 1', async () => {
      fake.enqueue({ data: [], count: 0 });
      await repo.search(search());

      const query = fake.queries[0];
      expect(query.table).toBe('ventas');
      expect(query.of('eq')).toEqual([]);
      expect(query.of('or')).toEqual([]);
      expect(query.of('gt')).toEqual([]);
      expect(query.first('range')).toEqual([0, 9]);
    });

    it('la página 3 de 10 pide las filas 20 a 29', async () => {
      fake.enqueue({ data: [], count: 0 });
      await repo.search(search({ page: 3, pageSize: 10 }));

      expect(fake.queries[0].first('range')).toEqual([20, 29]);
    });

    it('ordena por fecha descendente con desempate por id (las páginas no se mezclan)', async () => {
      fake.enqueue({ data: [], count: 0 });
      await repo.search(search());

      expect(fake.queries[0].of('order')).toEqual([
        ['fecha_actualizada', { ascending: false }],
        ['id', { ascending: false }],
      ]);
    });

    it('aplica sucursal, fecha y paciente', async () => {
      fake.enqueue({ data: [], count: 0 });
      await repo.search(search({ branch: 'MEDILENT', date: '2026-11-05', patientId: '77' }));

      expect(fake.queries[0].of('eq')).toEqual([
        ['paciente_id', '77'],
        ['sucursal', 'MEDILENT'],
        ['fecha_actualizada', '2026-11-05'],
      ]);
    });

    it('"con saldo" filtra resta > 0 y "pagadas" resta = 0', async () => {
      fake.enqueue({ data: [], count: 0 }).enqueue({ data: [], count: 0 });
      await repo.search(search({ status: 'balance' }));
      await repo.search(search({ status: 'paid' }));

      expect(fake.queries[0].first('gt')).toEqual(['resta', 0]);
      expect(fake.queries[1].first('eq')).toEqual(['resta', 0]);
    });

    it('el texto busca en paciente y folio, recortado y con los comodines escapados', async () => {
      fake.enqueue({ data: [], count: 0 });
      await repo.search(search({ query: '  50%_off  ' }));

      expect(fake.queries[0].first('or')).toEqual([
        'paciente_nombre.ilike.%50\\%\\_off%,folio.ilike.%50\\%\\_off%',
      ]);
    });

    it('un texto solo de espacios no filtra', async () => {
      fake.enqueue({ data: [], count: 0 });
      await repo.search(search({ query: '   ' }));

      expect(fake.queries[0].of('or')).toEqual([]);
    });

    it('un error de la base se devuelve como AppError', async () => {
      fake.enqueue({ error: { message: 'boom', code: 'XX000' } });
      const result = await repo.search(search());

      expect(result).toEqual({ ok: false, error: { kind: 'server', message: 'boom' } });
    });
  });

  describe('countByStatus', () => {
    it('devuelve los tres conteos en el orden todas / con saldo / pagadas', async () => {
      fake.enqueue({ count: 30 }).enqueue({ count: 12 }).enqueue({ count: 18 });
      const result = await repo.countByStatus({ query: '', branch: '', date: '' });

      expect(result).toEqual({ ok: true, value: { all: 30, balance: 12, paid: 18 } });
      expect(fake.queries[1].first('gt')).toEqual(['resta', 0]);
      expect(fake.queries[2].first('eq')).toEqual(['resta', 0]);
    });

    it('los tres conteos respetan los mismos filtros de sucursal y fecha', async () => {
      fake.enqueue({ count: 1 }).enqueue({ count: 1 }).enqueue({ count: 1 });
      await repo.countByStatus({ query: '', branch: 'MEDILENT', date: '2026-11-05' });

      for (const query of fake.queries) {
        expect(query.of('eq')).toContainEqual(['sucursal', 'MEDILENT']);
        expect(query.of('eq')).toContainEqual(['fecha_actualizada', '2026-11-05']);
      }
    });

    it('si cualquiera de los tres falla, devuelve ese error', async () => {
      fake.enqueue({ count: 1 }).enqueue({ error: { message: 'falló el segundo' } }).enqueue({ count: 1 });
      const result = await repo.countByStatus({ query: '', branch: '', date: '' });

      expect(result).toEqual({ ok: false, error: { kind: 'unknown', message: 'falló el segundo' } });
    });
  });

  describe('getItems', () => {
    it('busca por folio y mapea las líneas con precios numéricos', async () => {
      fake.enqueue({
        data: [{ id: 1, descripcion: 'Lente', precio: '120.5', montura_precio: null, montura: null, cantidad: '1' }],
      });
      const result = await repo.getItems('F-0010');

      expect(fake.queries[0].table).toBe('venta_items');
      expect(fake.queries[0].first('eq')).toEqual(['folio_venta', 'F-0010']);
      expect(result.ok && result.value[0]).toMatchObject({ id: 1, description: 'Lente', price: 120.5, mountPrice: 0, mount: '' });
    });
  });

  describe('changeDate', () => {
    it('changeDate solo toca la fecha', async () => {
      fake.enqueue({});
      await repo.changeDate('10', '2026-10-01');

      expect(fake.queries[0].first('update')).toEqual([{ fecha_actualizada: '2026-10-01' }]);
      expect(fake.queries[0].first('eq')).toEqual(['id', '10']);
    });

    it('si la base rechaza el cambio (RLS), devuelve unauthorized', async () => {
      fake.enqueue({ error: { message: 'El descuento requiere autorización', code: '42501' } });
      const result = await repo.changeDate('10', '2026-10-01');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('unauthorized');
    });
  });

  describe('create', () => {
    const sale: NewSale = {
      branch: 'MEDILENT',
      date: '2026-11-05',
      patientName: 'ANA LOPEZ',
      patientId: '12345678901234567',
      sellerName: 'Vendedor Prueba',
      total: 200,
      discount: 20,
      discountReason: 'promo',
      totalWithDiscount: 180,
      account: 50,
      rest: 130,
    };
    const resin: NewSaleItem = {
      kind: 'resin',
      resinId: 5,
      description: 'Resina 1.56',
      design: 'Monofocal',
      line: 'Eco',
      material: 'CR39',
      technology: 'Blue',
      text: '',
      price: 80,
    };
    const mount: NewSaleItem = {
      kind: 'mount',
      mountId: '900001',
      mountBrand: 'RayBan',
      mountModel: 'RB1',
      mountColor: 'Negro',
      mountText: '',
      price: 120,
    };
    const payment = { paymentMethod: 'efectivo', notes: 'Pago inicial de venta' };

    const rpcArgs = () => fake.queries[0].first('rpc')?.[0] as { p_sale: Record<string, unknown>; p_items: Record<string, unknown>[]; p_payment: unknown };

    it('hace UNA sola llamada a create_sale: nada de inserts sueltos', async () => {
      fake.enqueue({ data: row() });
      await repo.create(sale, [resin, mount], payment);

      expect(fake.queries).toHaveLength(1);
      expect(fake.queries[0].table).toBe('rpc:create_sale');
    });

    it('manda el encabezado con los nombres de la base, sin total con descuento ni saldo (los calcula el servidor)', async () => {
      fake.enqueue({ data: row() });
      await repo.create(sale, [resin], payment);

      expect(rpcArgs().p_sale).toEqual({
        sucursal: 'MEDILENT',
        fecha: '2026-11-05',
        paciente_id: '12345678901234567',
        paciente_nombre: 'ANA LOPEZ',
        autor_nombre: 'Vendedor Prueba',
        total: 200,
        descuento: 20,
        motivo_descuento: 'promo',
        a_cuenta: 50,
      });
    });

    it('manda una fila por línea, siempre de 1 unidad, con el armazón como texto', async () => {
      fake.enqueue({ data: row() });
      await repo.create(sale, [resin, mount], null);

      const items = rpcArgs().p_items;
      expect(items).toHaveLength(2);
      expect(items[0]).toMatchObject({ id_oftalmico: 5, descripcion: 'Resina 1.56', cantidad: '1', precio: 80 });
      expect(items[1]).toMatchObject({ id_montura: '900001', montura_marca: 'RayBan', montura_cantidad: '1', montura_precio: 120 });
      // Una línea de resina no lleva campos de montura y viceversa; id, venta y folio los pone el servidor.
      expect(items[0]).not.toHaveProperty('id_montura');
      expect(items[1]).not.toHaveProperty('id_oftalmico');
      expect(items[0]).not.toHaveProperty('venta_id');
      expect(items[0]).not.toHaveProperty('folio_venta');
    });

    it('manda el método de pago inicial, o null si no hay cuenta', async () => {
      fake.enqueue({ data: row() }).enqueue({ data: row() });
      await repo.create(sale, [resin], payment);
      await repo.create({ ...sale, account: 0 }, [resin], null);

      expect((fake.queries[0].first('rpc')?.[0] as { p_payment: unknown }).p_payment).toEqual({
        metodo_pago: 'efectivo',
        notas: 'Pago inicial de venta',
      });
      expect((fake.queries[1].first('rpc')?.[0] as { p_payment: unknown }).p_payment).toBeNull();
    });

    it('mapea la venta que devuelve la base (paciente_id llega como texto)', async () => {
      fake.enqueue({ data: row({ id: '77', folio: '997838' }) });
      const result = await repo.create(sale, [resin], payment);

      expect(result.ok && result.value).toMatchObject({ id: '77', folio: '997838', patientId: '12345678901234567', total: 200, rest: 130 });
    });

    it('si la base rechaza la venta (p. ej. sin stock), devuelve el error y no hay nada que limpiar', async () => {
      fake.enqueue({ error: { message: 'El armazón 900001 ya no está disponible o no alcanza el stock.', code: '23514' } });
      const result = await repo.create(sale, [mount], payment);

      expect(fake.queries).toHaveLength(1);
      expect(result).toEqual({
        ok: false,
        error: { kind: 'server', message: 'El armazón 900001 ya no está disponible o no alcanza el stock.' },
      });
    });

    it('si falta la autorización del descuento, devuelve unauthorized', async () => {
      fake.enqueue({ error: { message: 'El descuento requiere autorización de un supervisor', code: '42501' } });
      const result = await repo.create(sale, [resin], payment);

      expect(result).toEqual({
        ok: false,
        error: { kind: 'unauthorized', message: 'El descuento requiere autorización de un supervisor' },
      });
    });
  });
});
