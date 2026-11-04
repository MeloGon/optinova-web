import { TestBed } from '@angular/core/testing';
import { appError } from '../../core/errors/app-error';
import { ExpenseRepository } from '../../core/repositories/expense.repository';
import { PaymentRepository } from '../../core/repositories/payment.repository';
import { FakeExpenseRepository, fakeExpense } from '../../testing/fake-expense.repository';
import { FakePaymentRepository } from '../../testing/fake-payment.repository';
import { FakeSaleRepository, fakeSale } from '../../testing/fake-sale.repository';
import { PaymentsReportStore } from './payments-report.store';

describe('PaymentsReportStore', () => {
  let paymentRepo: FakePaymentRepository;
  let expenseRepo: FakeExpenseRepository;
  let store: PaymentsReportStore;

  beforeEach(() => {
    const saleRepo = new FakeSaleRepository();
    saleRepo.sales = [
      { ...fakeSale('V1'), branch: 'OFTALVISION', totalWithDiscount: 500, rest: 0 },
      { ...fakeSale('V2'), branch: 'MEDILENT', totalWithDiscount: 300, rest: 100 },
    ];
    paymentRepo = new FakePaymentRepository(saleRepo);
    paymentRepo.payments = [
      { id: 1, saleId: 'V1', amount: 400, date: '2026-11-05', paymentMethod: 'efectivo', registeredBy: 'X', notes: '', type: 'nueva_venta' },
      { id: 2, saleId: 'V1', amount: 100, date: '2026-11-06', paymentMethod: 'tarjeta', registeredBy: 'X', notes: '', type: 'abono_saldo' },
      { id: 3, saleId: 'V2', amount: 200, date: '2026-11-06', paymentMethod: 'efectivo', registeredBy: 'X', notes: '', type: 'nueva_venta' },
    ];

    expenseRepo = new FakeExpenseRepository();
    expenseRepo.expenses = [
      { ...fakeExpense(1, 'Luz'), date: '2026-11-05', amount: 120, categoryName: 'Servicios', branch: 'OFTALVISION' },
      { ...fakeExpense(2, 'Agua'), date: '2026-11-07', amount: 30, categoryName: 'Servicios', branch: 'OFTALVISION' },
    ];

    TestBed.configureTestingModule({
      providers: [
        PaymentsReportStore,
        { provide: PaymentRepository, useValue: paymentRepo },
        { provide: ExpenseRepository, useValue: expenseRepo },
      ],
    });
    store = TestBed.inject(PaymentsReportStore);
  });

  it('empieza sin cargar y sin movimientos', () => {
    expect(store.loaded()).toBe(false);
    expect(store.newSales()).toEqual([]);
  });

  it('separa nuevas ventas de saldos pagados y calcula los totales', async () => {
    await store.load({ from: '2026-11-01', to: '2026-11-30', branch: null });

    expect(store.newSales().map((p) => p.id)).toEqual([1, 3]);
    expect(store.balancePayments().map((p) => p.id)).toEqual([2]);
    expect(store.totals()).toEqual({ newSales: 600, balancePayments: 100, income: 700, expenses: 150, net: 550 });
  });

  it('agrupa por método de pago, de mayor a menor monto', async () => {
    await store.load({ from: '2026-11-01', to: '2026-11-30', branch: null });
    expect(store.newSalesByMethod()).toEqual([
      { key: 'efectivo', label: 'Efectivo', amount: 600, color: null },
    ]);
  });

  it('agrupa egresos por categoría', async () => {
    await store.load({ from: '2026-11-01', to: '2026-11-30', branch: null });
    expect(store.expensesByCategory()).toEqual([{ key: 'Servicios', label: 'Servicios', amount: 150, color: null }]);
  });

  it('filtra por sucursal (embebida desde la venta en los pagos)', async () => {
    await store.load({ from: '2026-11-01', to: '2026-11-30', branch: 'MEDILENT' });
    expect(store.newSales().map((p) => p.id)).toEqual([3]);
    expect(store.expenses()).toEqual([]);
  });

  it('un error en egresos no se esconde como "0": avisa y conserva los pagos cargados', async () => {
    expenseRepo.listByDateRangeFailWith = appError('network', 'Sin conexión.');
    await store.load({ from: '2026-11-01', to: '2026-11-30', branch: null });
    expect(store.error()).toContain('Egresos no disponibles');
    expect(store.newSales().length).toBeGreaterThan(0);
    expect(store.expenses()).toEqual([]);
  });

  it('un error en pagos se guarda como mensaje', async () => {
    paymentRepo.listByDateRangeFailWith = appError('network', 'Sin conexión.');
    await store.load({ from: '2026-11-01', to: '2026-11-30', branch: null });
    expect(store.error()).toBe('Sin conexión.');
    expect(store.loaded()).toBe(true);
  });
});
