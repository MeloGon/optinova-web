import { TestBed } from '@angular/core/testing';
import { appError } from '../../core/errors/app-error';
import { SaleRepository } from '../../core/repositories/sale.repository';
import { FakeSaleRepository, fakeSale } from '../../testing/fake-sale.repository';
import { SalesBySellerStore } from './sales-by-seller.store';

describe('SalesBySellerStore', () => {
  let repo: FakeSaleRepository;
  let store: SalesBySellerStore;

  beforeEach(() => {
    repo = new FakeSaleRepository();
    repo.sales = [
      { ...fakeSale(1), date: '2026-11-05', sellerName: 'ADMIN PRUEBA', totalWithDiscount: 100, account: 100, rest: 0, branch: 'OFTALVISION' },
      { ...fakeSale(2), date: '2026-11-10', sellerName: 'admin prueba', totalWithDiscount: 50, account: 0, rest: 50, branch: 'OFTALVISION' },
      { ...fakeSale(3), date: '2026-11-15', sellerName: 'Supervisor Prueba', totalWithDiscount: 200, account: 200, rest: 0, branch: 'MEDILENT' },
      { ...fakeSale(4), date: '2026-10-20', sellerName: 'Admin Prueba', totalWithDiscount: 999, account: 0, rest: 999, branch: 'OFTALVISION' },
    ];
    TestBed.configureTestingModule({
      providers: [SalesBySellerStore, { provide: SaleRepository, useValue: repo }],
    });
    store = TestBed.inject(SalesBySellerStore);
  });

  it('empieza sin cargar y sin vendedores', () => {
    expect(store.loaded()).toBe(false);
    expect(store.sellers()).toEqual([]);
  });

  it('agrupa por vendedor normalizando mayúsculas/minúsculas, dentro del mes pedido', async () => {
    await store.load({ month: '2026-11', branch: null });

    const admin = store.sellers().find((s) => s.name === 'Admin Prueba');
    expect(admin).toEqual({ name: 'Admin Prueba', salesCount: 2, total: 150, account: 100, rest: 50 });
    // La venta de octubre (999) no debe mezclarse con noviembre.
    expect(store.totals().total).toBe(350);
  });

  it('ordena de mayor a menor total vendido', async () => {
    await store.load({ month: '2026-11', branch: null });
    expect(store.sellers().map((s) => s.name)).toEqual(['Supervisor Prueba', 'Admin Prueba']);
  });

  it('filtra por sucursal', async () => {
    await store.load({ month: '2026-11', branch: 'MEDILENT' });
    expect(store.sellers().map((s) => s.name)).toEqual(['Supervisor Prueba']);
  });

  it('calcula los totales del período (no solo de una página, acá no hay paginación)', async () => {
    await store.load({ month: '2026-11', branch: null });
    expect(store.totals()).toEqual({ sellerCount: 2, salesCount: 3, total: 350, rest: 50 });
  });

  it('un error se guarda como mensaje', async () => {
    repo.listByMonthFailWith = appError('network', 'Sin conexión.');
    await store.load({ month: '2026-11', branch: null });
    expect(store.error()).toBe('Sin conexión.');
    expect(store.loaded()).toBe(true);
  });
});
