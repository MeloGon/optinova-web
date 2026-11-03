import { TestBed } from '@angular/core/testing';
import { appError } from '../errors/app-error';
import { PaymentRepository } from '../repositories/payment.repository';
import { SaleRepository } from '../repositories/sale.repository';
import { FakePaymentRepository } from '../../testing/fake-payment.repository';
import { FakeSaleRepository, fakeSale } from '../../testing/fake-sale.repository';
import { SalePaymentService } from './sale-payment.service';

describe('SalePaymentService', () => {
  let payments: FakePaymentRepository;
  let sales: FakeSaleRepository;
  let service: SalePaymentService;

  const sale = { ...fakeSale('10', 'F10'), totalWithDiscount: 1000, account: 300, rest: 700 };
  const draft = { saleId: '10', amount: 200, date: '2026-11-03', paymentMethod: 'efectivo', notes: '', type: 'abono_saldo' as const };

  beforeEach(() => {
    payments = new FakePaymentRepository();
    sales = new FakeSaleRepository();
    TestBed.configureTestingModule({
      providers: [
        { provide: PaymentRepository, useValue: payments },
        { provide: SaleRepository, useValue: sales },
      ],
    });
    service = TestBed.inject(SalePaymentService);
  });

  it('inserta el abono y deja la venta con su nuevo abonado y saldo', async () => {
    const result = await service.register(sale, draft, 'user-1');

    expect(result.ok).toBe(true);
    expect(payments.created).toHaveLength(1);
    expect(payments.created[0].registeredById).toBe('user-1');
    expect(sales.appliedPayments).toEqual([
      { saleId: '10', newAccount: 500, newRest: 500, paymentDate: '2026-11-03' },
    ]);
  });

  it('un abono que liquida la venta deja el saldo en 0, nunca negativo', async () => {
    await service.register(sale, { ...draft, amount: 700 }, 'user-1');
    expect(sales.appliedPayments[0]).toMatchObject({ newAccount: 1000, newRest: 0 });
  });

  it('si no se pudo insertar el abono, no toca el saldo de la venta', async () => {
    payments.createFailWith = appError('server', 'sin permisos');

    const result = await service.register(sale, draft, 'user-1');

    expect(result.ok).toBe(false);
    expect(sales.appliedPayments).toEqual([]);
  });

  it('si falla el segundo paso devuelve el error (el pago ya quedó insertado)', async () => {
    sales.applyPaymentFailWith = appError('server', 'falló');

    const result = await service.register(sale, draft, 'user-1');

    expect(result.ok).toBe(false);
    expect(payments.created).toHaveLength(1);
  });
});
