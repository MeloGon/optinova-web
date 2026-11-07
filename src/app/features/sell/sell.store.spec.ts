import { TestBed } from '@angular/core/testing';
import { appError } from '../../core/errors/app-error';
import { SessionStore } from '../../core/auth/session.store';
import { Role } from '../../core/models/role';
import { AuthRepository } from '../../core/repositories/auth.repository';
import { BranchSettingsRepository } from '../../core/repositories/branch-settings.repository';
import { DiscountAuthorizationRepository } from '../../core/repositories/discount-authorization.repository';
import { MountRepository } from '../../core/repositories/mount.repository';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { ResinRepository } from '../../core/repositories/resin.repository';
import { SaleRepository } from '../../core/repositories/sale.repository';
import { ReviewRepository } from '../../core/repositories/review.repository';
import { SellerRepository } from '../../core/repositories/seller.repository';
import { FakeAuthRepository, fakeProfile } from '../../testing/fake-auth.repository';
import { FakeBranchSettingsRepository } from '../../testing/fake-branch-settings.repository';
import { FakeDiscountAuthorizationRepository } from '../../testing/fake-discount-authorization.repository';
import { FakeMountRepository, fakeMount } from '../../testing/fake-mount.repository';
import { FakePatientRepository, fakePatient } from '../../testing/fake-patient.repository';
import { FakeResinRepository, fakeResin } from '../../testing/fake-resin.repository';
import { FakeReviewRepository, fakeReview } from '../../testing/fake-review.repository';
import { FakeSaleRepository } from '../../testing/fake-sale.repository';
import { FakeSellerRepository, fakeSeller } from '../../testing/fake-seller.repository';
import { SellStore } from './sell.store';

describe('SellStore', () => {
  let patientRepo: FakePatientRepository;
  let mountRepo: FakeMountRepository;
  let resinRepo: FakeResinRepository;
  let sellerRepo: FakeSellerRepository;
  let saleRepo: FakeSaleRepository;
  let reviewRepo: FakeReviewRepository;
  let branchSettingsRepo: FakeBranchSettingsRepository;
  let discountAuthRepo: FakeDiscountAuthorizationRepository;
  let store: SellStore;

  async function setup(role: Role = 'vendedor'): Promise<void> {
    TestBed.resetTestingModule();
    const auth = new FakeAuthRepository();
    auth.session = fakeProfile(role);
    patientRepo = new FakePatientRepository();
    mountRepo = new FakeMountRepository();
    resinRepo = new FakeResinRepository();
    sellerRepo = new FakeSellerRepository();
    saleRepo = new FakeSaleRepository();
    reviewRepo = new FakeReviewRepository();
    branchSettingsRepo = new FakeBranchSettingsRepository();
    discountAuthRepo = new FakeDiscountAuthorizationRepository();

    TestBed.configureTestingModule({
      providers: [
        SellStore,
        { provide: AuthRepository, useValue: auth },
        { provide: PatientRepository, useValue: patientRepo },
        { provide: MountRepository, useValue: mountRepo },
        { provide: ResinRepository, useValue: resinRepo },
        { provide: SellerRepository, useValue: sellerRepo },
        { provide: SaleRepository, useValue: saleRepo },
        { provide: ReviewRepository, useValue: reviewRepo },
        { provide: BranchSettingsRepository, useValue: branchSettingsRepo },
        { provide: DiscountAuthorizationRepository, useValue: discountAuthRepo },
      ],
    });
    await TestBed.inject(SessionStore).restore();
    store = TestBed.inject(SellStore);
  }

  it('arranca sin paciente, con la sucursal del perfil logueado', async () => {
    await setup();
    expect(store.patient()).toBeNull();
    expect(store.branch()).toBe('OFTALVISION');
    expect(store.cart()).toEqual([]);
  });

  it('al elegir un paciente, carga los vendedores', async () => {
    await setup();
    sellerRepo.sellers = [fakeSeller(1, 'ANA LOPEZ')];
    await store.selectPatient(fakePatient(1, 'JUAN PEREZ'));

    expect(store.patient()?.name).toBe('JUAN PEREZ');
    expect(store.sellers().map((s) => s.name)).toEqual(['ANA LOPEZ']);
  });

  it('al elegir un paciente, usa su medida más reciente como graduación por defecto', async () => {
    await setup();
    // FakeReviewRepository.getByPatient devuelve en el orden del array: la más reciente primero.
    reviewRepo.reviews = [fakeReview(2, '5', { date: '2026-10-01' }), fakeReview(1, '5', { date: '2026-09-01' })];
    await store.selectPatient(fakePatient(5));

    expect(store.selectedReview()?.id).toBe('2');

    store.selectReview('1');
    expect(store.selectedReview()?.id).toBe('1');
  });

  it('cambiar de paciente reinicia todo el estado', async () => {
    await setup();
    await store.selectPatient(fakePatient(1));
    store.setDiscount(10, 'motivo');
    store.changePatient();

    expect(store.patient()).toBeNull();
    expect(store.discount()).toBe(0);
    expect(store.branch()).toBe('OFTALVISION');
  });

  it('busca monturas con stock, filtrando por marca/modelo', async () => {
    await setup();
    mountRepo.mounts = [fakeMount(1, 'RAY-BAN'), fakeMount(2, 'OAKLEY'), { ...fakeMount(3, 'RAY-BAN'), stock: 0 }];
    await store.searchCatalog('ray');

    expect(store.mounts().map((m) => m.id)).toEqual(['1']);
  });

  it('busca resinas por descripción, no solo por "texto" (bug real: Flutter solo buscaba "texto")', async () => {
    await setup();
    store.setCatalogOption('resin');
    resinRepo.resins = [{ ...fakeResin(1, 'RESINA PRUEBA 12'), text: 'Texto de prueba 12' }];
    await store.searchCatalog('resina prueba 12');

    expect(store.resins().map((r) => r.id)).toEqual([1]);
  });

  it('el catálogo pagina de 10 en 10 y cambiar de página repite la última búsqueda', async () => {
    await setup();
    mountRepo.mounts = Array.from({ length: 15 }, (_, i) => fakeMount(i + 1, 'RAY-BAN'));
    await store.searchCatalog('ray');

    expect(store.mounts().length).toBe(10);
    expect(store.catalogTotal()).toBe(15);
    expect(store.catalogPage()).toBe(1);

    await store.setCatalogPage(2);
    expect(store.mounts().map((m) => m.id)).toEqual(['11', '12', '13', '14', '15']);
    expect(store.catalogPage()).toBe(2);
  });

  it('agregar dos veces el mismo armazón crea dos líneas, no una con cantidad 2', async () => {
    await setup();
    const mount = fakeMount(1, 'RAY-BAN', 5);
    store.addMount(mount);
    store.addMount(mount);

    expect(store.cart().length).toBe(2);
    expect(store.total()).toBe(600);
  });

  it('agregar o quitar un ítem resetea descuento y cuenta', async () => {
    await setup();
    store.setDiscount(20, 'promo');
    store.setAccount(50);
    store.addResin(fakeResin(1));

    expect(store.discount()).toBe(0);
    expect(store.account()).toBe(0);
  });

  it('calcula total, total con descuento y resto', async () => {
    await setup();
    store.addResin({ ...fakeResin(1), price: 400 });
    store.addMount({ ...fakeMount(2), price: 300 });
    store.setDiscount(100, 'promo');
    store.setAccount(200);

    expect(store.total()).toBe(700);
    expect(store.totalWithDiscount()).toBe(600);
    expect(store.rest()).toBe(400);
  });

  it('el resto nunca baja de 0 aunque la cuenta supere el total', async () => {
    await setup();
    store.addResin({ ...fakeResin(1), price: 100 });
    store.setAccount(500);

    expect(store.rest()).toBe(0);
  });

  it('editar el precio de una línea recalcula los totales', async () => {
    await setup();
    store.addResin({ ...fakeResin(1), price: 100 });
    const line = store.cart()[0];
    store.updateCartLinePrice(line.localId, 250);

    expect(store.total()).toBe(250);
  });

  describe('autorización de descuentos (P-04)', () => {
    async function withDiscount(role: Role, requireAuth: boolean): Promise<void> {
      await setup(role);
      branchSettingsRepo.settings = [{ branch: 'OFTALVISION', discountRequiresAuth: requireAuth }];
      await store.loadDiscountPolicy();
      await store.selectPatient(fakePatient(1));
      store.setSeller(fakeSeller(1));
      store.addResin({ ...fakeResin(1), price: 100 });
      store.setDiscount(20, 'promo');
    }

    it('con la sucursal sin regla, el vendedor descuenta directo', async () => {
      await withDiscount('vendedor', false);
      expect(store.discountNeedsAuth()).toBe(false);
      expect(store.discountAuthorized()).toBe(true);
      expect(store.canConfirm()).toBe(true);
    });

    it('con la regla activa, el vendedor no puede confirmar un descuento sin autorizar', async () => {
      await withDiscount('vendedor', true);
      expect(store.discountNeedsAuth()).toBe(true);
      expect(store.discountAuthorized()).toBe(false);
      expect(store.canConfirm()).toBe(false);

      const result = await store.confirmSale();
      expect(result.ok).toBe(false);
      expect(saleRepo.created).toHaveLength(0);
    });

    it('un supervisor autoriza y el descuento queda cubierto hasta ese monto', async () => {
      await withDiscount('vendedor', true);
      const result = await store.authorizeDiscount('sup@x.com', 'clave');

      expect(result.ok).toBe(true);
      expect(discountAuthRepo.calls).toEqual([{ email: 'sup@x.com', password: 'clave', amount: 20 }]);
      expect(store.discountAuthorized()).toBe(true);

      store.setDiscount(10, 'promo');
      expect(store.discountAuthorized()).toBe(true);
      store.setDiscount(30, 'promo');
      expect(store.discountAuthorized()).toBe(false);
    });

    it('si las credenciales fallan, el descuento sigue sin autorizar', async () => {
      await withDiscount('vendedor', true);
      discountAuthRepo.failWith = appError('unknown', 'Correo o contraseña incorrectos.');
      const result = await store.authorizeDiscount('sup@x.com', 'mal');

      expect(result.ok).toBe(false);
      expect(store.discountAuthorized()).toBe(false);
    });

    it('supervisor descuenta directo aunque la regla esté activa', async () => {
      await withDiscount('supervisor', true);
      expect(store.discountNeedsAuth()).toBe(false);
      expect(store.canConfirm()).toBe(true);
    });
  });

  describe('canConfirm', () => {
    it('es falso sin paciente, vendedor, sucursal o carrito', async () => {
      await setup();
      expect(store.canConfirm()).toBe(false);

      await store.selectPatient(fakePatient(1));
      expect(store.canConfirm()).toBe(false); // sin vendedor ni carrito

      store.setSeller(fakeSeller(1));
      store.addResin(fakeResin(1));
      expect(store.canConfirm()).toBe(true);
    });

    it('con cuenta > 0 hace falta un método de pago', async () => {
      await setup();
      await store.selectPatient(fakePatient(1));
      store.setSeller(fakeSeller(1));
      store.addResin(fakeResin(1));
      store.setAccount(50);

      expect(store.canConfirm()).toBe(false);
      store.setPaymentMethod('efectivo');
      expect(store.canConfirm()).toBe(true);
    });
  });

  describe('confirmSale', () => {
    async function readyToSell(): Promise<void> {
      await setup();
      await store.selectPatient(fakePatient(5, 'JUAN PEREZ'));
      store.setSeller(fakeSeller(1, 'ANA LOPEZ'));
      store.setBranch('MEDILENT');
    }

    it('rechaza sin paciente, vendedor, sucursal o carrito', async () => {
      await setup();
      const result = await store.confirmSale();
      expect(result.ok).toBe(false);
    });

    it('crea la venta con el encabezado y todas las líneas en UNA sola llamada', async () => {
      await readyToSell();
      const mount = fakeMount(10, 'RAY-BAN', 5);
      store.addMount(mount);
      store.addMount(mount);
      store.addResin(fakeResin(20));

      const result = await store.confirmSale();

      expect(result.ok).toBe(true);
      expect(saleRepo.created).toHaveLength(1);
      expect(saleRepo.created[0].sale).toEqual(
        expect.objectContaining({ branch: 'MEDILENT', patientId: '5', sellerName: 'ANA LOPEZ', total: 1000 }),
      );
      // dos líneas del mismo armazón + una resina; el descuento de stock lo hace la base dentro de `create`.
      expect(saleRepo.created[0].items.length).toBe(3);
      expect(saleRepo.created[0].items.filter((i) => i.kind === 'mount').length).toBe(2);
    });

    it('si hay cuenta inicial, le pasa a create el método de pago (el monto es la cuenta de la venta)', async () => {
      await readyToSell();
      store.addResin({ ...fakeResin(1), price: 100 });
      store.setAccount(60);
      store.setPaymentMethod('efectivo');

      const result = await store.confirmSale();

      expect(result.ok).toBe(true);
      expect(saleRepo.created[0].sale.account).toBe(60);
      expect(saleRepo.created[0].initialPayment).toEqual({ paymentMethod: 'efectivo', notes: 'Pago inicial de venta' });
    });

    it('sin cuenta inicial, no manda ningún pago', async () => {
      await readyToSell();
      store.addResin({ ...fakeResin(1), price: 100 });

      await store.confirmSale();

      expect(saleRepo.created[0].initialPayment).toBeNull();
    });

    it('rechaza un monto a cuenta mayor al total con descuento, sin llamar a la base', async () => {
      await readyToSell();
      store.addResin({ ...fakeResin(1), price: 100 });
      store.setDiscount(20, 'promo');
      store.setAccount(90);
      store.setPaymentMethod('efectivo');

      const result = await store.confirmSale();

      expect(result.ok).toBe(false);
      expect(saleRepo.created).toHaveLength(0);
    });

    it('si crear la venta falla (p. ej. sin stock), no queda nada guardado y el carrito se conserva para reintentar', async () => {
      await readyToSell();
      store.addMount(fakeMount(10));
      saleRepo.createFailWith = { kind: 'server', message: 'El armazón 10 ya no está disponible.' };

      const result = await store.confirmSale();

      expect(result.ok).toBe(false);
      expect(saleRepo.created).toHaveLength(0);
      expect(store.error()).toBe('El armazón 10 ya no está disponible.');
      expect(store.cart().length).toBe(1);
      expect(store.saving()).toBe(false);
    });

    it('al terminar con éxito, reinicia el carrito y el paciente', async () => {
      await readyToSell();
      store.addResin(fakeResin(1));

      await store.confirmSale();

      expect(store.patient()).toBeNull();
      expect(store.cart()).toEqual([]);
      expect(store.branch()).toBe('OFTALVISION');
    });

    it('devuelve la venta creada y las líneas, para armar el recibo después del reinicio', async () => {
      await readyToSell();
      store.addResin({ ...fakeResin(1), price: 150 });

      const result = await store.confirmSale();

      expect(result.ok && result.value.sale.total).toBe(150);
      expect(result.ok && result.value.items.length).toBe(1);
    });
  });
});
