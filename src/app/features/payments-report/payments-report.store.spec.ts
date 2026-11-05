import { TestBed } from '@angular/core/testing';
import { appError } from '../../core/errors/app-error';
import { PaymentReportEntry } from '../../core/repositories/payments-report.repository';
import { PaymentsReportRepository } from '../../core/repositories/payments-report.repository';
import { fakeExpense } from '../../testing/fake-expense.repository';
import { FakePaymentsReportRepository } from '../../testing/fake-payments-report.repository';
import { PaymentsReportStore } from './payments-report.store';

const payment = (id: number, overrides: Partial<PaymentReportEntry>): PaymentReportEntry => ({
  id,
  saleId: `V${id}`,
  amount: 0,
  date: '2026-11-05',
  paymentMethod: 'efectivo',
  registeredBy: 'X',
  notes: '',
  type: 'abono_saldo',
  patientName: 'Paciente',
  folio: `F${id}`,
  branch: 'OFTALVISION',
  saleTotal: 0,
  saleRest: 0,
  ...overrides,
});

describe('PaymentsReportStore', () => {
  let repo: FakePaymentsReportRepository;
  let store: PaymentsReportStore;

  beforeEach(() => {
    repo = new FakePaymentsReportRepository();
    repo.payments = [
      payment(1, { amount: 400, date: '2026-11-05', type: 'nueva_venta', branch: 'OFTALVISION' }),
      payment(2, { amount: 100, date: '2026-11-06', paymentMethod: 'tarjeta', type: 'abono_saldo', branch: 'OFTALVISION' }),
      payment(3, { amount: 200, date: '2026-11-06', type: 'nueva_venta', branch: 'MEDILENT' }),
    ];
    repo.expenses = [
      { ...fakeExpense(1, 'Luz'), date: '2026-11-05', amount: 120, categoryName: 'Servicios', branch: 'OFTALVISION' },
      { ...fakeExpense(2, 'Agua'), date: '2026-11-07', amount: 30, categoryName: 'Servicios', branch: 'OFTALVISION' },
    ];

    TestBed.configureTestingModule({
      providers: [PaymentsReportStore, { provide: PaymentsReportRepository, useValue: repo }],
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
    expect(store.newSalesByMethod()).toEqual([{ key: 'efectivo', label: 'Efectivo', amount: 600, color: null }]);
  });

  it('agrupa egresos por categoría', async () => {
    await store.load({ from: '2026-11-01', to: '2026-11-30', branch: null });
    expect(store.expensesByCategory()).toEqual([{ key: 'Servicios', label: 'Servicios', amount: 150, color: null }]);
  });

  it('filtra por sucursal (la decide el servidor, acá solo se pide)', async () => {
    await store.load({ from: '2026-11-01', to: '2026-11-30', branch: 'MEDILENT' });
    expect(store.newSales().map((p) => p.id)).toEqual([3]);
    expect(store.expenses()).toEqual([]);
  });

  it('un error se guarda como mensaje', async () => {
    repo.failWith = appError('network', 'Sin conexión.');
    await store.load({ from: '2026-11-01', to: '2026-11-30', branch: null });
    expect(store.error()).toBe('Sin conexión.');
    expect(store.loaded()).toBe(true);
  });

  it('pide el rango y la sucursal pedidos, sin más filtros propios', async () => {
    await store.load({ from: '2026-11-01', to: '2026-11-30', branch: 'MEDILENT' });
    expect(repo.calls).toEqual([{ from: '2026-11-01', to: '2026-11-30', branch: 'MEDILENT' }]);
  });
});
