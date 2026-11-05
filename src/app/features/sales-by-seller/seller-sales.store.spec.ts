import { TestBed } from '@angular/core/testing';
import { appError } from '../../core/errors/app-error';
import { SalesBySellerReportRepository } from '../../core/repositories/sales-by-seller-report.repository';
import { fakeSale } from '../../testing/fake-sale.repository';
import { FakeSalesBySellerReportRepository } from '../../testing/fake-sales-by-seller-report.repository';
import { SellerSalesStore } from './seller-sales.store';

describe('SellerSalesStore', () => {
  let repo: FakeSalesBySellerReportRepository;
  let store: SellerSalesStore;

  beforeEach(() => {
    repo = new FakeSalesBySellerReportRepository();
    repo.sales = [
      { ...fakeSale(1), date: '2026-11-05', sellerName: 'ADMIN PRUEBA', totalWithDiscount: 100, account: 100, rest: 0 },
      { ...fakeSale(2), date: '2026-11-10', sellerName: 'admin prueba', totalWithDiscount: 50, account: 0, rest: 50 },
      { ...fakeSale(3), date: '2026-11-15', sellerName: 'Supervisor Prueba', totalWithDiscount: 200, account: 200, rest: 0 },
    ];
    TestBed.configureTestingModule({
      providers: [SellerSalesStore, { provide: SalesBySellerReportRepository, useValue: repo }],
    });
    store = TestBed.inject(SellerSalesStore);
  });

  it('empieza sin cargar y sin ventas', () => {
    expect(store.loaded()).toBe(false);
    expect(store.page()).toEqual([]);
  });

  it('filtra solo las ventas del vendedor pedido (normalizado), de la más reciente a la más antigua', async () => {
    await store.load({ sellerName: 'Admin Prueba', month: '2026-11', branch: null, page: 1, pageSize: 10 });
    expect(store.page().map((s) => s.id)).toEqual(['2', '1']);
    expect(store.total()).toBe(2);
  });

  it('pagina de verdad en el servidor (acá solo recibe la página pedida)', async () => {
    await store.load({ sellerName: 'Admin Prueba', month: '2026-11', branch: null, page: 1, pageSize: 1 });
    expect(store.page().map((s) => s.id)).toEqual(['2']);
    expect(store.total()).toBe(2);
  });

  it('calcula los totales del vendedor filtrado (del período completo, no solo de la página)', async () => {
    await store.load({ sellerName: 'Admin Prueba', month: '2026-11', branch: null, page: 1, pageSize: 10 });
    expect(store.totals()).toEqual({ total: 150, account: 100, rest: 50 });
  });

  it('un error se guarda como mensaje', async () => {
    repo.detailFailWith = appError('network', 'Sin conexión.');
    await store.load({ sellerName: 'Admin Prueba', month: '2026-11', branch: null, page: 1, pageSize: 10 });
    expect(store.error()).toBe('Sin conexión.');
    expect(store.loaded()).toBe(true);
  });
});
