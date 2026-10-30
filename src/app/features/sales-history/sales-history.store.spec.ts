import { TestBed } from '@angular/core/testing';
import { appError } from '../../core/errors/app-error';
import { PaymentRepository } from '../../core/repositories/payment.repository';
import { SaleRepository } from '../../core/repositories/sale.repository';
import { FakePaymentRepository, fakePayment } from '../../testing/fake-payment.repository';
import { FakeSaleRepository, fakeSale } from '../../testing/fake-sale.repository';
import { SalesHistoryStore } from './sales-history.store';

describe('SalesHistoryStore', () => {
  let saleRepo: FakeSaleRepository;
  let paymentRepo: FakePaymentRepository;
  let store: SalesHistoryStore;

  beforeEach(() => {
    saleRepo = new FakeSaleRepository();
    saleRepo.sales = [
      { ...fakeSale(1, 'MARIA LOPEZ'), rest: 100 },
      { ...fakeSale(2, 'JUAN GARCIA'), rest: 0 },
      { ...fakeSale(3, 'ANA GARCIA'), rest: 50 },
    ];
    paymentRepo = new FakePaymentRepository();
    TestBed.configureTestingModule({
      providers: [
        SalesHistoryStore,
        { provide: SaleRepository, useValue: saleRepo },
        { provide: PaymentRepository, useValue: paymentRepo },
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

  it('al registrar un abono, lo inserta y actualiza el saldo de la venta', async () => {
    await store.load(search());
    const sale = store.items()[0]; // id '1', rest 100

    const result = await store.registerPayment(
      sale,
      { saleId: sale.id, amount: 40, date: '2026-10-10', paymentMethod: 'efectivo', notes: '' },
      'user-id-1',
    );

    expect(result.ok).toBe(true);
    expect(paymentRepo.created[0].registeredById).toBe('user-id-1');
    expect(saleRepo.appliedPayments[0]).toEqual({
      saleId: '1',
      newAccount: 40,
      newRest: 60,
      paymentDate: '2026-10-10',
    });
    expect(store.items().find((s) => s.id === '1')?.rest).toBe(60);
  });

  it('si insertar el abono falla, no toca el saldo de la venta', async () => {
    await store.load(search());
    const sale = store.items()[0];
    paymentRepo.createFailWith = appError('server', 'Falló.');

    const result = await store.registerPayment(
      sale,
      { saleId: sale.id, amount: 40, date: '2026-10-10', paymentMethod: 'efectivo', notes: '' },
      'user-id-1',
    );

    expect(result.ok).toBe(false);
    expect(saleRepo.appliedPayments.length).toBe(0);
  });

  it('el abono no deja el resto en negativo aunque se pase del saldo', async () => {
    await store.load(search());
    const sale = store.items()[0]; // totalWithDiscount 100, rest 100

    await store.registerPayment(
      sale,
      { saleId: sale.id, amount: 150, date: '2026-10-10', paymentMethod: 'efectivo', notes: '' },
      'user-id-1',
    );

    expect(saleRepo.appliedPayments[0].newRest).toBe(0);
  });
});
