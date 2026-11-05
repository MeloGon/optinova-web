import { AppError } from '../core/errors/app-error';
import { Sale } from '../core/models/sale';
import {
  SalesBySellerReportRepository,
  SellerAggregate,
  SellerDetailData,
  SellerDetailSearch,
  SellerSummarySearch,
} from '../core/repositories/sales-by-seller-report.repository';
import { Result, err, ok } from '../core/result';

/** "ADMIN PRUEBA" / "admin prueba" → "Admin Prueba" (= `initcap(btrim(...))` de la RPC). */
function normalizeSellerName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'Sin vendedor';
  return trimmed
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** SalesBySellerReportRepository en memoria para tests: agrupa/filtra/pagina como lo hacen
 * `sales_by_seller_summary`/`sales_by_seller_detail`. */
export class FakeSalesBySellerReportRepository extends SalesBySellerReportRepository {
  sales: Sale[] = [];
  summaryFailWith: AppError | null = null;
  detailFailWith: AppError | null = null;
  summaryCalls: SellerSummarySearch[] = [];
  detailCalls: SellerDetailSearch[] = [];

  private matches(month: string, branch: string | null): Sale[] {
    return this.sales.filter((s) => s.date.startsWith(month) && (!branch || s.branch === branch));
  }

  async summary(search: SellerSummarySearch): Promise<Result<SellerAggregate[], AppError>> {
    this.summaryCalls.push(search);
    if (this.summaryFailWith) return err(this.summaryFailWith);

    const byName = new Map<string, SellerAggregate>();
    for (const sale of this.matches(search.month, search.branch)) {
      const name = normalizeSellerName(sale.sellerName);
      const current = byName.get(name) ?? { name, salesCount: 0, total: 0, account: 0, rest: 0 };
      current.salesCount += 1;
      current.total += sale.totalWithDiscount;
      current.account += sale.account;
      current.rest += sale.rest;
      byName.set(name, current);
    }
    return ok([...byName.values()].sort((a, b) => b.total - a.total));
  }

  async detail(search: SellerDetailSearch): Promise<Result<SellerDetailData, AppError>> {
    this.detailCalls.push(search);
    if (this.detailFailWith) return err(this.detailFailWith);

    const matches = this.matches(search.month, search.branch)
      .filter((s) => normalizeSellerName(s.sellerName) === search.sellerName)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

    const from = (search.page - 1) * search.pageSize;
    return ok({
      sales: matches.slice(from, from + search.pageSize),
      totalCount: matches.length,
      total: matches.reduce((sum, s) => sum + s.totalWithDiscount, 0),
      account: matches.reduce((sum, s) => sum + s.account, 0),
      rest: matches.reduce((sum, s) => sum + s.rest, 0),
    });
  }
}
