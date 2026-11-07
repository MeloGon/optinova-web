import { TestBed } from '@angular/core/testing';
import { appError } from '../errors/app-error';
import { PaymentRepository } from '../repositories/payment.repository';
import { FakePaymentRepository } from '../../testing/fake-payment.repository';
import { FakeSaleRepository, fakeSale } from '../../testing/fake-sale.repository';
import { SalePaymentService } from './sale-payment.service';

describe('SalePaymentService', () => {
  let payments: FakePaymentRepository;
  let sales: FakeSaleRepository;
  let service: SalePaymentService;

  const draft = { saleId: '10', amount: 200, date: '2026-11-03', paymentMethod: 'efectivo', notes: '', type: 'abono_saldo' as const };

  beforeEach(() => {
    sales = new FakeSaleRepository();
    sales.sales = [{ ...fakeSale('10', 'F10'), totalWithDiscount: 1000, account: 300, rest: 700 }];
    payments = new FakePaymentRepository(sales);
    TestBed.configureTestingModule({ providers: [{ provide: PaymentRepository, useValue: payments }] });
    service = TestBed.inject(SalePaymentService);
  });

  it('registra el abono en UNA llamada y la venta queda con su nuevo abonado y saldo', async () => {
    const result = await service.register(draft);

    expect(result.ok).toBe(true);
    expect(payments.registered).toEqual([draft]);
    expect(sales.sales[0]).toMatchObject({ account: 500, rest: 500 });
  });

  it('un abono que liquida la venta deja el saldo en 0', async () => {
    await service.register({ ...draft, amount: 700 });
    expect(sales.sales[0]).toMatchObject({ account: 1000, rest: 0 });
  });

  it('un abono mayor al saldo se rechaza y no guarda nada (ni abono ni saldo)', async () => {
    const result = await service.register({ ...draft, amount: 701 });

    expect(result.ok).toBe(false);
    expect(payments.registered).toEqual([]);
    expect(payments.payments).toEqual([]);
    expect(sales.sales[0]).toMatchObject({ account: 300, rest: 700 });
  });

  it('si la base falla, devuelve el error y no cambia el saldo', async () => {
    payments.registerFailWith = appError('server', 'sin permisos');

    const result = await service.register(draft);

    expect(result.ok).toBe(false);
    expect(sales.sales[0]).toMatchObject({ account: 300, rest: 700 });
  });
});
