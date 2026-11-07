import { Injectable, computed, inject, signal } from '@angular/core';
import { SessionStore } from '../../core/auth/session.store';
import { AppError, appError } from '../../core/errors/app-error';
import { Mount } from '../../core/models/mount';
import { Patient } from '../../core/models/patient';
import { Resin } from '../../core/models/resin';
import { NewSaleItem } from '../../core/models/sale-item';
import { Sale } from '../../core/models/sale';
import { Seller } from '../../core/models/seller';
import { MountRepository } from '../../core/repositories/mount.repository';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { Review } from '../../core/models/review';
import { ResinRepository } from '../../core/repositories/resin.repository';
import { NewInitialPayment, NewSale, SaleRepository } from '../../core/repositories/sale.repository';
import { ReviewRepository } from '../../core/repositories/review.repository';
import { SellerRepository } from '../../core/repositories/seller.repository';
import { BranchSettingsRepository } from '../../core/repositories/branch-settings.repository';
import { DiscountAuthorizationRepository } from '../../core/repositories/discount-authorization.repository';
import { Result, err, ok } from '../../core/result';

export type CatalogOption = 'mount' | 'resin';

/** No abruma al vendedor con el inventario entero de una sola vez (pedido del dueño, 2026-10-31). */
const CATALOG_PAGE_SIZE = 10;

/** Una línea del carrito: el producto elegido, con el precio editable (= SellItemCard de Flutter). */
export interface CartLine {
  localId: number;
  item: NewSaleItem;
  label: string;
}

/** Lo que queda de la venta recién creada, para armar el recibo después de que el store se reinicia. */
export interface SellSnapshot {
  sale: Sale;
  items: NewSaleItem[];
}

interface SellState {
  patient: Patient | null;
  patients: Patient[];
  searchingPatients: boolean;
  patientsError: string | null;

  sellers: Seller[];
  seller: Seller | null;
  branch: string;
  /** `yyyy-MM-dd`. */
  date: string;

  /** Medidas del paciente elegido, de la más reciente a la más antigua (= "graduación que se usará"). */
  reviews: Review[];
  selectedReviewId: string | null;

  catalogOption: CatalogOption;
  /** Filtro de sucursal del selector de monturas; no es la sucursal de la venta (ver `branch`). */
  catalogBranch: string | null;
  /** Última búsqueda pedida: se repite al cambiar de página. */
  catalogQuery: string;
  catalogPage: number;
  catalogTotal: number;
  mounts: Mount[];
  resins: Resin[];
  searchingCatalog: boolean;
  catalogError: string | null;

  cart: CartLine[];
  discount: number;
  discountReason: string;
  /** Hasta cuánto descuento autorizó un supervisor en esta venta (0 = nada autorizado todavía). */
  authorizedDiscount: number;
  account: number;
  paymentMethod: string | null;

  saving: boolean;
  error: string | null;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function initialState(branch: string): SellState {
  return {
    patient: null,
    patients: [],
    searchingPatients: false,
    patientsError: null,
    sellers: [],
    seller: null,
    branch,
    date: today(),
    reviews: [],
    selectedReviewId: null,
    catalogOption: 'mount',
    catalogBranch: null,
    catalogQuery: '',
    catalogPage: 1,
    catalogTotal: 0,
    mounts: [],
    resins: [],
    searchingCatalog: false,
    catalogError: null,
    cart: [],
    discount: 0,
    discountReason: '',
    authorizedDiscount: 0,
    account: 0,
    paymentMethod: null,
    saving: false,
    error: null,
  };
}

/**
 * Estado de Vender (= `Sell` Notifier de Riverpod, recortado al alcance de E2.6: carrito, totales
 * y confirmar venta). Se provee en la página (`providers: [SellStore]`), igual que el resto de los
 * stores de features: nace y muere con la pantalla (a diferencia de Flutter, que lo mantiene vivo
 * con `keepAlive` para no perder el carrito al cambiar de pestaña — acá no hace falta porque no hay
 * pestañas que compitan por la misma pantalla).
 */
@Injectable()
export class SellStore {
  private readonly patientRepo = inject(PatientRepository);
  private readonly mountRepo = inject(MountRepository);
  private readonly resinRepo = inject(ResinRepository);
  private readonly sellerRepo = inject(SellerRepository);
  private readonly saleRepo = inject(SaleRepository);
  private readonly reviewRepo = inject(ReviewRepository);
  private readonly branchSettingsRepo = inject(BranchSettingsRepository);
  private readonly discountAuthRepo = inject(DiscountAuthorizationRepository);
  private readonly session = inject(SessionStore);

  private readonly state = signal<SellState>(initialState(this.session.profile()?.branch ?? ''));
  /**
   * Sucursales donde el descuento de un vendedor exige autorización. Vive fuera de `state` a
   * propósito: se carga una vez y debe sobrevivir al reinicio que sigue a cada venta.
   */
  private readonly authBranches = signal<string[]>([]);
  private nextLocalId = 1;

  readonly patient = computed(() => this.state().patient);
  readonly patients = computed(() => this.state().patients);
  readonly searchingPatients = computed(() => this.state().searchingPatients);
  readonly patientsError = computed(() => this.state().patientsError);

  readonly sellers = computed(() => this.state().sellers);
  readonly seller = computed(() => this.state().seller);
  readonly branch = computed(() => this.state().branch);
  readonly date = computed(() => this.state().date);

  readonly reviews = computed(() => this.state().reviews);
  /** La graduación que se usará (= la elegida, o la más reciente si no se elige otra). */
  readonly selectedReview = computed(() => {
    const s = this.state();
    return s.reviews.find((r) => r.id === s.selectedReviewId) ?? s.reviews[0] ?? null;
  });

  readonly catalogOption = computed(() => this.state().catalogOption);
  readonly catalogBranch = computed(() => this.state().catalogBranch);
  readonly catalogPage = computed(() => this.state().catalogPage);
  readonly catalogPageSize = CATALOG_PAGE_SIZE;
  readonly catalogTotal = computed(() => this.state().catalogTotal);
  readonly mounts = computed(() => this.state().mounts);
  readonly resins = computed(() => this.state().resins);
  readonly searchingCatalog = computed(() => this.state().searchingCatalog);
  readonly catalogError = computed(() => this.state().catalogError);

  readonly cart = computed(() => this.state().cart);
  readonly discount = computed(() => this.state().discount);
  readonly discountReason = computed(() => this.state().discountReason);
  readonly account = computed(() => this.state().account);
  readonly paymentMethod = computed(() => this.state().paymentMethod);

  readonly saving = computed(() => this.state().saving);
  readonly error = computed(() => this.state().error);

  /**
   * Supervisor y admin descuentan directo. Un vendedor también, salvo que su sucursal (o la de la
   * venta) exija autorización: ahí cada descuento necesita el correo y contraseña de un supervisor
   * (P-04), que el servidor vuelve a comprobar al guardar la venta (trigger `trg_ventas_descuento`).
   */
  readonly discountNeedsAuth = computed(() => {
    if (this.session.can('supervisor')) return false;
    const required = this.authBranches();
    return required.includes(this.state().branch) || required.includes(this.session.profile()?.branch ?? '');
  });

  /** `true` si el descuento puesto ya puede guardarse (no hace falta permiso, o ya está autorizado). */
  readonly discountAuthorized = computed(() => {
    const s = this.state();
    return !this.discountNeedsAuth() || s.discount <= 0 || s.discount <= s.authorizedDiscount;
  });

  /** Carga la regla de descuentos por sucursal. Si falla, el servidor igual hace cumplir la regla al guardar. */
  async loadDiscountPolicy(): Promise<void> {
    const result = await this.branchSettingsRepo.list();
    if (result.ok) this.authBranches.set(result.value.filter((s) => s.discountRequiresAuth).map((s) => s.branch));
  }

  /** Pide a un supervisor que autorice el descuento actual; al lograrlo, queda autorizado hasta ese monto. */
  async authorizeDiscount(email: string, password: string): Promise<Result<void, AppError>> {
    const amount = this.state().discount;
    const result = await this.discountAuthRepo.authorize(email, password, amount);
    if (result.ok) this.state.update((s) => ({ ...s, authorizedDiscount: Math.max(s.authorizedDiscount, amount) }));
    return result;
  }

  readonly total = computed(() => this.state().cart.reduce((sum, line) => sum + line.item.price, 0));
  readonly totalWithDiscount = computed(() => Math.max(this.total() - this.state().discount, 0));
  readonly rest = computed(() => Math.max(this.totalWithDiscount() - this.state().account, 0));

  readonly canConfirm = computed(() => {
    const s = this.state();
    if (!s.patient || !s.seller || !s.branch.trim() || s.cart.length === 0) return false;
    if (s.account > 0 && !s.paymentMethod) return false;
    return this.discountAuthorized();
  });

  async searchPatients(query: string): Promise<void> {
    this.state.update((s) => ({ ...s, searchingPatients: true, patientsError: null }));
    const result = await this.patientRepo.search({ query, page: 1, pageSize: 20 });
    this.state.update((s) =>
      result.ok
        ? { ...s, patients: result.value.items, searchingPatients: false }
        : { ...s, patients: [], searchingPatients: false, patientsError: result.error.message },
    );
  }

  /**
   * = `selectPatient` de Flutter: fija al paciente, trae los vendedores para el paso 3 y la
   * graduación más reciente para mostrarla en los pasos 1 y 3 (= "graduación que se usará").
   */
  async selectPatient(patient: Patient): Promise<void> {
    this.state.update((s) => ({ ...s, patient, patients: [] }));
    const [sellers, reviews] = await Promise.all([this.sellerRepo.list(), this.reviewRepo.getByPatient(patient.id)]);
    this.state.update((s) => ({
      ...s,
      sellers: sellers.ok ? sellers.value : s.sellers,
      reviews: reviews.ok ? reviews.value : s.reviews,
    }));
  }

  /** = "Usar otra revisión" del diseño: por defecto se usa la más reciente. */
  selectReview(reviewId: string | null): void {
    this.state.update((s) => ({ ...s, selectedReviewId: reviewId }));
  }

  /** = `cancelSale` de Flutter: vuelve al paso 1, sin paciente ni carrito. */
  changePatient(): void {
    this.state.set(initialState(this.session.profile()?.branch ?? ''));
  }

  setSeller(seller: Seller | null): void {
    this.state.update((s) => ({ ...s, seller }));
  }

  setBranch(branch: string): void {
    this.state.update((s) => ({ ...s, branch }));
  }

  setDate(date: string): void {
    this.state.update((s) => ({ ...s, date }));
  }

  setCatalogOption(option: CatalogOption): void {
    this.state.update((s) => ({ ...s, catalogOption: option, mounts: [], resins: [], catalogPage: 1, catalogTotal: 0 }));
  }

  setCatalogBranch(branch: string | null): void {
    this.state.update((s) => ({ ...s, catalogBranch: branch, catalogPage: 1 }));
  }

  /** Repite la última búsqueda en otra página (= clic en el paginador del catálogo). */
  setCatalogPage(page: number): Promise<void> {
    return this.searchCatalog(this.state().catalogQuery, page);
  }

  async searchCatalog(query: string, page = 1): Promise<void> {
    const { catalogOption, catalogBranch } = this.state();
    this.state.update((s) => ({ ...s, searchingCatalog: true, catalogError: null, catalogQuery: query, catalogPage: page }));

    if (catalogOption === 'mount') {
      const result = await this.mountRepo.search({ query, branch: catalogBranch, page, pageSize: CATALOG_PAGE_SIZE });
      this.state.update((s) =>
        result.ok
          ? { ...s, searchingCatalog: false, mounts: result.value.items, catalogTotal: result.value.total }
          : { ...s, searchingCatalog: false, mounts: [], catalogTotal: 0, catalogError: result.error.message },
      );
      return;
    }

    const result = await this.resinRepo.search({ query, page, pageSize: CATALOG_PAGE_SIZE });
    this.state.update((s) =>
      result.ok
        ? { ...s, searchingCatalog: false, resins: result.value.items, catalogTotal: result.value.total }
        : { ...s, searchingCatalog: false, resins: [], catalogTotal: 0, catalogError: result.error.message },
    );
  }

  /** Agrega una línea (= `selectItemToSell` con una montura). Un "Agregar" = una unidad; dos
   * clics del mismo armazón son dos líneas, no una línea con cantidad 2 (igual que Flutter). */
  addMount(mount: Mount): void {
    this.addCartLine(
      {
        kind: 'mount',
        mountId: mount.id,
        mountBrand: mount.brand,
        mountModel: mount.model,
        mountColor: mount.color,
        mountText: mount.description,
        price: mount.price,
      },
      `${mount.brand} ${mount.model}`.trim(),
    );
  }

  addResin(resin: Resin): void {
    this.addCartLine(
      {
        kind: 'resin',
        resinId: resin.id,
        description: resin.description,
        design: resin.design,
        line: resin.line,
        material: resin.material,
        technology: resin.technology,
        text: resin.text,
        price: resin.price,
      },
      resin.description || resin.text || 'Resina',
    );
  }

  private addCartLine(item: NewSaleItem, label: string): void {
    const line: CartLine = { localId: this.nextLocalId++, item, label };
    // = `_recalculateTotals` de Flutter: agregar o quitar un ítem resetea descuento y cuenta.
    this.state.update((s) => ({ ...s, cart: [...s.cart, line], discount: 0, account: 0 }));
  }

  removeCartLine(localId: number): void {
    this.state.update((s) => ({ ...s, cart: s.cart.filter((l) => l.localId !== localId), discount: 0, account: 0 }));
  }

  /** = `updateItemPrice` de Flutter: edita el precio de una línea ya agregada, sin tocar descuento ni cuenta. */
  updateCartLinePrice(localId: number, price: number): void {
    this.state.update((s) => ({
      ...s,
      cart: s.cart.map((l) => (l.localId === localId ? { ...l, item: { ...l.item, price } } : l)),
    }));
  }

  setDiscount(amount: number, reason: string): void {
    this.state.update((s) => ({ ...s, discount: Math.max(amount, 0), discountReason: reason }));
  }

  setAccount(amount: number): void {
    this.state.update((s) => ({ ...s, account: Math.max(amount, 0) }));
  }

  setPaymentMethod(method: string | null): void {
    this.state.update((s) => ({ ...s, paymentMethod: method }));
  }

  /**
   * Crea la venta (= `createSale` de Flutter, pero atómico): venta, líneas, descuento de stock y
   * pago inicial se guardan en UNA transacción en la base (`create_sale`). Si algo falla (p. ej. un
   * armazón sin stock suficiente) no queda nada a medias: ni una venta sin líneas, ni stock restado
   * de una venta que no existe. Flutter lo hacía en pasos sueltos y restaba siempre 1 por venta;
   * acá se resta la cantidad real de líneas por armazón (1 por "Agregar").
   */
  async confirmSale(): Promise<Result<SellSnapshot, AppError>> {
    const s = this.state();
    if (!s.patient) return err(appError('unknown', 'Selecciona un paciente antes de crear la venta.'));
    if (!s.seller) return err(appError('unknown', 'Selecciona un vendedor antes de crear la venta.'));
    if (!s.branch.trim()) return err(appError('unknown', 'Selecciona una sucursal antes de crear la venta.'));
    if (s.cart.length === 0) return err(appError('unknown', 'Agrega al menos un producto antes de crear la venta.'));
    if (!this.discountAuthorized()) {
      return err(appError('unknown', 'El descuento necesita la autorización de un supervisor.'));
    }
    if (s.account > 0 && !s.paymentMethod) {
      return err(appError('unknown', 'Selecciona un método de pago para el monto a cuenta.'));
    }
    if (s.account > this.totalWithDiscount()) {
      return err(appError('unknown', 'El monto a cuenta no puede ser mayor al total con descuento.'));
    }

    this.state.update((st) => ({ ...st, saving: true, error: null }));

    const discount = s.discount;
    const total = this.total();
    const totalWithDiscount = this.totalWithDiscount();
    const account = s.account;
    const rest = this.rest();
    const items = s.cart.map((l) => l.item);

    const newSale: NewSale = {
      branch: s.branch,
      date: s.date,
      patientName: s.patient.name,
      patientId: s.patient.id,
      sellerName: s.seller.name,
      total,
      discount,
      discountReason: discount > 0 ? s.discountReason.trim() || null : null,
      totalWithDiscount,
      account,
      rest,
    };

    const initialPayment: NewInitialPayment | null =
      account > 0 ? { paymentMethod: s.paymentMethod ?? 'otro', notes: 'Pago inicial de venta' } : null;

    const created = await this.saleRepo.create(newSale, items, initialPayment);
    if (!created.ok) {
      this.state.update((st) => ({ ...st, saving: false, error: created.error.message }));
      return created;
    }

    const snapshot: SellSnapshot = { sale: created.value, items };
    this.state.set(initialState(this.session.profile()?.branch ?? ''));
    return ok(snapshot);
  }
}
