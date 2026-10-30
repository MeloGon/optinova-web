import { AppError } from '../core/errors/app-error';
import { Page } from '../core/models/page';
import { Sale } from '../core/models/sale';
import { SaleItem } from '../core/models/sale-item';
import { SaleRepository, SaleSearch, SaleStatusCounts } from '../core/repositories/sale.repository';
import { Result, err, ok } from '../core/result';

export const fakeSale = (id: number | string, patientName = `PACIENTE ${id}`): Sale => ({
  id: String(id),
  folio: `F-${id}`,
  branch: 'OFTALVISION',
  date: '2026-10-01',
  patientName,
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

  private matches(params: Pick<SaleSearch, 'query' | 'branch' | 'date'>): Sale[] {
    const text = params.query.trim().toLowerCase();
    return this.sales.filter((s) => {
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
}
