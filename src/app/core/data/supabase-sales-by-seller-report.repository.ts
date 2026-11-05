import { Injectable, inject } from '@angular/core';
import { AppError, toAppError } from '../errors/app-error';
import { Sale } from '../models/sale';
import {
  SalesBySellerReportRepository,
  SellerAggregate,
  SellerDetailData,
  SellerDetailSearch,
  SellerSummarySearch,
} from '../repositories/sales-by-seller-report.repository';
import { Result, err, ok } from '../result';
import { monthRange } from '../../shared/utils/month';
import { SUPABASE } from '../supabase/supabase.client';

interface SellerRow {
  name: string;
  sales_count: number;
  total: number;
  account: number;
  rest: number;
}

interface SaleRow {
  id: string;
  folio: string | null;
  branch: string | null;
  date: string | null;
  patient_name: string | null;
  patient_id: string | null;
  seller_name: string | null;
  total: number | null;
  discount: number | null;
  total_with_discount: number | null;
  account: number | null;
  rest: number | null;
}

interface SummaryPayload {
  sellers: SellerRow[];
}

interface DetailPayload {
  total_count: number;
  total: number;
  account: number;
  rest: number;
  sales: SaleRow[];
}

function toSellerAggregate(row: SellerRow): SellerAggregate {
  return {
    name: row.name,
    salesCount: row.sales_count,
    total: Number(row.total),
    account: Number(row.account),
    rest: Number(row.rest),
  };
}

function toSale(row: SaleRow): Sale {
  const total = Number(row.total ?? 0);
  return {
    id: row.id,
    folio: row.folio ?? '',
    branch: row.branch ?? '',
    date: row.date ?? '',
    patientName: row.patient_name ?? '',
    patientId: row.patient_id,
    sellerName: row.seller_name ?? '',
    total,
    discount: Number(row.discount ?? 0),
    totalWithDiscount: Number(row.total_with_discount ?? total),
    account: Number(row.account ?? 0),
    rest: Number(row.rest ?? 0),
  };
}

/** = SalesBySellerReportRepository, vía `sales_by_seller_summary`/`sales_by_seller_detail` (#23). */
@Injectable()
export class SupabaseSalesBySellerReportRepository extends SalesBySellerReportRepository {
  private readonly supabase = inject(SUPABASE);

  async summary({ month, branch }: SellerSummarySearch): Promise<Result<SellerAggregate[], AppError>> {
    const { from, to } = monthRange(month);
    const { data, error } = await this.supabase.rpc('sales_by_seller_summary', {
      p_from: from,
      p_to: to,
      p_branch: branch,
    });
    if (error) return err(toAppError(error));

    const payload = data as SummaryPayload;
    return ok(payload.sellers.map(toSellerAggregate));
  }

  async detail({ month, branch, sellerName, page, pageSize }: SellerDetailSearch): Promise<Result<SellerDetailData, AppError>> {
    const { from, to } = monthRange(month);
    const { data, error } = await this.supabase.rpc('sales_by_seller_detail', {
      p_from: from,
      p_to: to,
      p_seller_name: sellerName,
      p_branch: branch,
      p_page: page,
      p_page_size: pageSize,
    });
    if (error) return err(toAppError(error));

    const payload = data as DetailPayload;
    return ok({
      sales: payload.sales.map(toSale),
      totalCount: payload.total_count,
      total: Number(payload.total),
      account: Number(payload.account),
      rest: Number(payload.rest),
    });
  }
}
