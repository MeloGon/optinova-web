import { Dialog } from '@angular/cdk/dialog';
import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { LucideBanknote, LucideCalculator, LucideDynamicIcon, LucideHandCoins, LucideRefreshCw, LucideTriangleAlert, LucideUsers } from '@lucide/angular';
import { ConfigService } from '../../core/config/config.service';
import { SaleMonthSearch } from '../../core/repositories/sale.repository';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { OnvTable, TableCard } from '../../shared/ui/table/table';
import { CommissionsDialog, CommissionsDialogData, COMMISSIONS_DIALOG_TITLE_ID } from './components/commissions-dialog';
import { MONTH_OPTIONS, toMonth, yearOptions } from '../../shared/utils/month';
import { SalesBySellerStore } from './sales-by-seller.store';

/**
 * Settings · Ventas por vendedor (sin pantalla equivalente directa en Flutter: ahí repite
 * encabezado + 3 tarjetas + tabla propia por cada vendedor; acá es una sola tabla de agregados,
 * ordenada de mayor a menor venta, mismo patrón de "ranking" que ya usa el Dashboard). Sin
 * paginar: es un reporte de un mes, no una lista que crece sin límite. El nombre del vendedor
 * lleva a su propia página con las ventas (`seller-sales.page`), igual que la ficha de paciente:
 * un dialog no aguanta bien ni muchas filas ni mobile. URL guarda el filtro (?month=&branch=).
 */
@Component({
  selector: 'app-sales-by-seller-page',
  imports: [RouterLink, MoneyPipe, LucideDynamicIcon, EmptyState, OnvTable, TableCard],
  providers: [SalesBySellerStore],
  templateUrl: './sales-by-seller.page.html',
})
export class SalesBySellerPage {
  readonly month = input<string>();
  readonly branch = input<string>();

  protected readonly store = inject(SalesBySellerStore);
  private readonly config = inject(ConfigService).config;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(Dialog);

  protected readonly branches = computed(() => this.config().branches);
  protected readonly monthOptions = MONTH_OPTIONS;
  protected readonly yearOptions = yearOptions();

  protected readonly search = computed<SaleMonthSearch>(() => ({
    month: toMonth(this.month()),
    branch: this.branch() || null,
  }));

  protected readonly selectedMonth = computed(() => this.search().month.split('-')[1]);
  protected readonly selectedYear = computed(() => this.search().month.split('-')[0]);
  protected readonly selectedYearNumber = computed(() => Number(this.selectedYear()));

  protected readonly icons = {
    total: LucideBanknote,
    pending: LucideHandCoins,
    sellers: LucideUsers,
    calculator: LucideCalculator,
    alert: LucideTriangleAlert,
    retry: LucideRefreshCw,
  };

  constructor() {
    effect(() => {
      const search = this.search();
      untracked(() => void this.store.load(search));
    });
  }

  protected setMonth(monthNumber: string): void {
    void this.navigate({ month: `${this.selectedYear()}-${monthNumber}` });
  }

  protected setYear(year: string): void {
    void this.navigate({ month: `${year}-${this.selectedMonth()}` });
  }

  protected setBranch(value: string): void {
    void this.navigate({ branch: value || null });
  }

  protected retry(): void {
    void this.store.load(this.search());
  }

  protected openCommissions(): void {
    const data: CommissionsDialogData = { sellers: this.store.sellers() };
    this.dialog.open<void>(CommissionsDialog, {
      data,
      role: 'dialog',
      ariaLabelledBy: COMMISSIONS_DIALOG_TITLE_ID,
      backdropClass: ['bg-overlay'],
    });
  }

  private navigate(queryParams: Params): Promise<boolean> {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
