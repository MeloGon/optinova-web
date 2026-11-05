import { AppError } from '../core/errors/app-error';
import { Page } from '../core/models/page';
import { Sale } from '../core/models/sale';
import { NewSaleItem, SaleItem } from '../core/models/sale-item';
import { NewSale, SaleRepository, SaleSearch, SaleStatusCounts } from '../core/repositories/sale.repository';
import { Result, err, ok } from '../core/result';

export const fakeSale = (id: number | string, patientName = `PACIENTE ${id}`, patientId: string | null = null): Sale => ({
  id: String(id),
  folio: `F-${id}`,
  branch: 'OFTALVISION',
  date: '2026-10-01',
  patientName,
  patientId,
  sellerName: 'Vendedor Prueba',
  total: 100,
  discount: 0,
  totalWithDiscount: 100,
  account: 0,
  rest: 100,
});

/** SaleRepository en memoria para tests. */
export class FakeSaleRepository extends SaleRepository {
  sales: Sale[] = [];
  items: Record<string, SaleItem[]> = {};

  calls: SaleSearch[] = [];
  failWith: AppError | null = null;
  countsFailWith: AppError | null = null;

  appliedPayments: { saleId: string; newAccount: number; newRest: number; paymentDate: string }[] = [];
  applyPaymentFailWith: AppError | null = null;

  created: { sale: NewSale; items: NewSaleItem[] }[] = [];
  createFailWith: AppError | null = null;
  private nextId = 9000;

  private matches(params: Pick<SaleSearch, 'query' | 'branch' | 'date' | 'patientId'>): Sale[] {
    const text = params.query.trim().toLowerCase();
    return this.sales.filter((s) => {
      if (params.patientId && s.patientId !== params.patientId) return false;
      if (text && !s.patientName.toLowerCase().includes(text) && !s.folio.toLowerCase().includes(text)) return false;
      if (params.branch && s.branch !== params.branch) return false;
      if (params.date && s.date !== params.date) return false;
      return true;
    });
  }

  async search(params: SaleSearch): Promise<Result<Page<Sale>, AppError>> {
    this.calls.push(params);
    if (this.failWith) return err(this.failWith);

    const byStatus = this.matches(params).filter((s) => {
      if (params.status === 'balance') return s.rest > 0;
      if (params.status === 'paid') return s.rest === 0;
      return true;
    });
    const from = (params.page - 1) * params.pageSize;
    return ok({ items: byStatus.slice(from, from + params.pageSize), total: byStatus.length });
  }

  async countByStatus(
    params: Pick<SaleSearch, 'query' | 'branch' | 'date'>,
  ): Promise<Result<SaleStatusCounts, AppError>> {
    if (this.countsFailWith) return err(this.countsFailWith);
    const matches = this.matches(params);
    return ok({
      all: matches.length,
      balance: matches.filter((s) => s.rest > 0).length,
      paid: matches.filter((s) => s.rest === 0).length,
    });
  }

  async getItems(folio: string): Promise<Result<SaleItem[], AppError>> {
    return ok(this.items[folio] ?? []);
  }

  async applyPayment(
    saleId: string,
    newAccount: number,
    newRest: number,
    paymentDate: string,
  ): Promise<Result<void, AppError>> {
    if (this.applyPaymentFailWith) return err(this.applyPaymentFailWith);
    this.appliedPayments.push({ saleId, newAccount, newRest, paymentDate });
    this.sales = this.sales.map((s) => (s.id === saleId ? { ...s, account: newAccount, rest: newRest } : s));
    return ok(undefined);
  }

  changeDateCalls: { saleId: string; newDate: string }[] = [];
  changeDateFailWith: AppError | null = null;

  async changeDate(saleId: string, newDate: string): Promise<Result<void, AppError>> {
    if (this.changeDateFailWith) return err(this.changeDateFailWith);
    this.changeDateCalls.push({ saleId, newDate });
    this.sales = this.sales.map((s) => (s.id === saleId ? { ...s, date: newDate } : s));
    return ok(undefined);
  }

  async create(sale: NewSale, items: NewSaleItem[]): Promise<Result<Sale, AppError>> {
    if (this.createFailWith) return err(this.createFailWith);
    this.created.push({ sale, items });
    const id = this.nextId++;
    const created: Sale = {
      id: String(id),
      folio: String(id),
      branch: sale.branch,
      date: sale.date,
      patientName: sale.patientName,
      patientId: sale.patientId,
      sellerName: sale.sellerName,
      total: sale.total,
      discount: sale.discount,
      totalWithDiscount: sale.totalWithDiscount,
      account: sale.account,
      rest: sale.rest,
    };
    this.sales = [...this.sales, created];
    this.items[created.folio] = items.map((item, index) => toFakeSaleItem(index, item));
    return ok(created);
  }
}

function toFakeSaleItem(index: number, item: NewSaleItem): SaleItem {
  const base: SaleItem = {
    id: index,
    description: '',
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
  };
  if (item.kind === 'resin') {
    return {
      ...base,
      description: item.description,
      design: item.design,
      line: item.line,
      material: item.material,
      technology: item.technology,
      text: item.text,
      quantity: '1',
      price: item.price,
    };
  }
  return {
    ...base,
    mountBrand: item.mountBrand,
    mountModel: item.mountModel,
    mountColor: item.mountColor,
    mountQuantity: '1',
    mountPrice: item.price,
    mountText: item.mountText,
  };
}
