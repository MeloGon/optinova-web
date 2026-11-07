import { TestBed } from '@angular/core/testing';
import { appError } from '../../core/errors/app-error';
import { AppConfigRepository } from '../../core/repositories/app-config.repository';
import { AuditLogRepository } from '../../core/repositories/audit-log.repository';
import { PaymentRepository } from '../../core/repositories/payment.repository';
import { SaleRepository } from '../../core/repositories/sale.repository';
import { FakeAppConfigRepository } from '../../testing/fake-app-config.repository';
import { FakeAuditLogRepository } from '../../testing/fake-audit-log.repository';
import { FakePaymentRepository, fakePayment } from '../../testing/fake-payment.repository';
import { FakeSaleRepository, fakeSale } from '../../testing/fake-sale.repository';
import { SalesHistoryStore } from './sales-history.store';

describe('SalesHistoryStore', () => {
  let saleRepo: FakeSaleRepository;
  let paymentRepo: FakePaymentRepository;
  let appConfigRepo: FakeAppConfigRepository;
  let auditLog: FakeAuditLogRepository;
  let store: SalesHistoryStore;

  beforeEach(() => {
    saleRepo = new FakeSaleRepository();
    saleRepo.sales = [
      { ...fakeSale(1, 'MARIA LOPEZ'), rest: 100 },
      { ...fakeSale(2, 'JUAN GARCIA'), rest: 0 },
      { ...fakeSale(3, 'ANA GARCIA'), rest: 50 },
    ];
    paymentRepo = new FakePaymentRepository(saleRepo);
    appConfigRepo = new FakeAppConfigRepository();
    auditLog = new FakeAuditLogRepository();
    TestBed.configureTestingModule({
      providers: [
        SalesHistoryStore,
        { provide: SaleRepository, useValue: saleRepo },
        { provide: PaymentRepository, useValue: paymentRepo },
        { provide: AppConfigRepository, useValue: appConfigRepo },
        { provide: AuditLogRepository, useValue: auditLog },
      ],
    });
    store = TestBed.inject(SalesHistoryStore);
  });

  const search = (over: Partial<Parameters<SalesHistoryStore['load']>[0]> = {}) => ({
    query: '',
    branch: null,
    date: null,
    status: 'all' as const,
    page: 1,
    pageSize: 10,
    ...over,
  });

  it('empieza sin cargar y sin resultados', () => {
    expect(store.loaded()).toBe(false);
    expect(store.items()).toEqual([]);
    expect(store.total()).toBe(0);
    expect(store.counts()).toEqual({ all: 0, balance: 0, paid: 0 });
  });

  it('carga la página pedida, el total y los contadores por estado', async () => {
    await store.load(search({ pageSize: 2 }));
    expect(store.items().map((s) => s.id)).toEqual(['1', '2']);
    expect(store.total()).toBe(3);
    expect(store.counts()).toEqual({ all: 3, balance: 2, paid: 1 });
    expect(store.loaded()).toBe(true);
  });

  it('status "balance" filtra por resta > 0', async () => {
    await store.load(search({ status: 'balance' }));
    expect(store.items().map((s) => s.id)).toEqual(['1', '3']);
  });

  it('status "paid" filtra por resta === 0', async () => {
    await store.load(search({ status: 'paid' }));
    expect(store.items().map((s) => s.id)).toEqual(['2']);
  });

  it('busca en paciente y folio a la vez', async () => {
    await store.load(search({ query: 'F-2' }));
    expect(store.items().map((s) => s.id)).toEqual(['2']);
  });

  it('un error se guarda como mensaje', async () => {
    saleRepo.failWith = appError('network', 'Sin conexión.');
    await store.load(search());
    expect(store.error()).toBe('Sin conexión.');
    expect(store.loaded()).toBe(true);
  });

  it('pide las líneas de una venta por folio', async () => {
    saleRepo.items['F-1'] = [
      {
        id: 1,
        description: 'Lente',
        design: '',
        line: '',
        material: '',
        technology: '',
        serie: '',
        text: '',
        quantity: '',
        price: 0,
        mount: '',
        mountBrand: '',
        mountModel: '',
        mountColor: '',
        mountQuantity: '',
        mountPrice: 0,
        mountText: '',
      },
    ];
    const result = await store.loadItems('F-1');
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.length).toBe(1);
  });

  it('pide los abonos de una venta', async () => {
    paymentRepo.payments = [fakePayment(1, '1'), fakePayment(2, '2')];
    const result = await store.loadPayments('1');
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.map((p) => p.id)).toEqual([1]);
  });

  it('al registrar un abono, lo guarda y la lista refleja el nuevo saldo', async () => {
    await store.load(search());
    const sale = store.items()[0]; // id '1', rest 100

    const result = await store.registerPayment({
      saleId: sale.id,
      amount: 40,
      date: '2026-10-10',
      paymentMethod: 'efectivo',
      notes: '',
      type: 'abono_saldo',
    });

    expect(result.ok).toBe(true);
    expect(paymentRepo.registered).toHaveLength(1);
    expect(paymentRepo.registered[0]).toMatchObject({ saleId: '1', amount: 40 });
    expect(store.items().find((s) => s.id === '1')?.rest).toBe(60);
    expect(store.items().find((s) => s.id === '1')?.account).toBe(40);
  });

  it('si registrar el abono falla, no cambia el saldo de la venta', async () => {
    await store.load(search());
    const sale = store.items()[0];
    paymentRepo.registerFailWith = appError('server', 'Falló.');

    const result = await store.registerPayment({
      saleId: sale.id,
      amount: 40,
      date: '2026-10-10',
      paymentMethod: 'efectivo',
      notes: '',
      type: 'abono_saldo',
    });

    expect(result.ok).toBe(false);
    expect(paymentRepo.registered).toHaveLength(0);
    expect(store.items().find((s) => s.id === '1')?.rest).toBe(100);
  });

  it('un abono mayor al saldo se rechaza (la base lo valida) y no cambia nada', async () => {
    await store.load(search());
    const sale = store.items()[0]; // rest 100

    const result = await store.registerPayment({
      saleId: sale.id,
      amount: 150,
      date: '2026-10-10',
      paymentMethod: 'efectivo',
      notes: '',
      type: 'abono_saldo',
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.message).toContain('supera el saldo');
    expect(paymentRepo.registered).toHaveLength(0);
    expect(store.items().find((s) => s.id === '1')?.rest).toBe(100);
  });

  it('carga el flag de "cambiar fecha" desde app_config', async () => {
    appConfigRepo.features = [{ key: 'feature_change_date', value: false, description: '' }];
    await store.loadChangeDateFlag();
    expect(store.changeDateEnabled()).toBe(false);
  });

  it('sin el flag en la lista, se queda con el valor por defecto (habilitado)', async () => {
    appConfigRepo.features = [];
    await store.loadChangeDateFlag();
    expect(store.changeDateEnabled()).toBe(true);
  });

  it('al cambiar la fecha, guarda, audita y refresca la lista pedida', async () => {
    await store.load(search());
    const sale = store.items()[0];

    const result = await store.changeDate(sale, '2026-12-25', 'admin@optinova.test');

    expect(result.ok).toBe(true);
    expect(saleRepo.changeDateCalls).toEqual([{ saleId: sale.id, newDate: '2026-12-25' }]);
    expect(auditLog.logged[0].entry.action).toBe('change_date');
    expect(auditLog.logged[0].userEmail).toBe('admin@optinova.test');
  });

  it('si cambiar la fecha falla, no audita', async () => {
    await store.load(search());
    saleRepo.changeDateFailWith = appError('server', 'Falló.');

    const result = await store.changeDate(store.items()[0], '2026-12-25', 'admin@optinova.test');

    expect(result.ok).toBe(false);
    expect(auditLog.logged.length).toBe(0);
  });
});
