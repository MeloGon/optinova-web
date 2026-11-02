import { Dialog } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LucideArrowLeft, LucideArrowRight, LucideCheck, LucideDynamicIcon } from '@lucide/angular';
import { ConfigService } from '../../core/config/config.service';
import { formatMoney } from '../../shared/pipes/money.pipe';
import { Step, Stepper } from '../../shared/ui/stepper/stepper';
import { CheckoutStep } from './components/checkout-step';
import { PatientStep } from './components/patient-step';
import { ProductsStep } from './components/products-step';
import { SaleCreatedDialog, SaleCreatedDialogData, SaleCreatedResult, SALE_CREATED_TITLE_ID } from './components/sale-created-dialog';
import { SalePreviewDialog, SalePreviewDialogData, SALE_PREVIEW_TITLE_ID } from './components/sale-preview-dialog';
import { SellSnapshot, SellStore } from './sell.store';

/**
 * Nueva venta (= S-04 Claude Design, 3 pasos). La página solo decide en qué paso está (estado de
 * navegación, no de negocio); el carrito, los totales y confirmar la venta viven en `SellStore`,
 * compartido con los 3 pasos por inyección (lo provee esta página, lo inyectan los hijos).
 */
@Component({
  selector: 'app-sell-page',
  imports: [Stepper, PatientStep, ProductsStep, CheckoutStep, LucideDynamicIcon],
  providers: [SellStore],
  templateUrl: './sell.page.html',
})
export class SellPage {
  protected readonly store = inject(SellStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  protected readonly config = inject(ConfigService).config;

  protected readonly currentStep = signal<1 | 2 | 3>(1);

  protected readonly icons = { back: LucideArrowLeft, next: LucideArrowRight, confirm: LucideCheck };

  protected readonly steps = computed<Step[]>(() => {
    const current = this.currentStep();
    const cartCount = this.store.cart().length;
    const productsHint =
      current === 2
        ? `${cartCount} ${cartCount === 1 ? 'producto elegido' : 'productos elegidos'}`
        : `${cartCount} ${cartCount === 1 ? 'producto' : 'productos'} · ${formatMoney(this.store.total(), this.config().currency)}`;

    return [
      {
        label: 'Paciente',
        hint: this.store.patient()?.name ?? 'Busca o agrega al paciente',
        state: current === 1 ? 'current' : this.store.patient() ? 'complete' : 'upcoming',
      },
      {
        label: 'Productos',
        hint: current < 2 ? 'Resinas, armazones y otros' : productsHint,
        state: current === 2 ? 'current' : current > 2 ? 'complete' : 'upcoming',
      },
      {
        label: 'Revisar y confirmar',
        hint: current === 3 ? 'Confirma el cobro' : 'Precios, descuento y cobro',
        state: current === 3 ? 'current' : 'upcoming',
      },
    ];
  });

  /** = la frase del pie en el paso 3: "se cobrarán S/. 500.00 por Yape" o "sin cobro inicial". */
  protected readonly chargeSummary = computed(() => {
    const account = this.store.account();
    if (account <= 0) return 'Sin cobro inicial';
    const method = this.config().paymentMethods.find((m) => m.value === this.store.paymentMethod());
    return `Se cobrarán ${formatMoney(account, this.config().currency)}${method ? ' por ' + method.label : ''}`;
  });

  protected goToStep(index: number): void {
    this.currentStep.set((index + 1) as 1 | 2 | 3);
  }

  protected next(): void {
    if (this.currentStep() < 3) this.currentStep.update((s) => (s + 1) as 1 | 2 | 3);
  }

  protected back(): void {
    if (this.currentStep() > 1) this.currentStep.update((s) => (s - 1) as 1 | 2 | 3);
  }

  protected cancel(): void {
    this.store.changePatient();
    this.currentStep.set(1);
    void this.router.navigateByUrl('/dashboard');
  }

  /** = botón "Confirmar venta": primero muestra el ticket simulado (pedido del dueño, 2026-11-01). */
  protected openPreview(): void {
    const method = this.config().paymentMethods.find((m) => m.value === this.store.paymentMethod());
    const data: SalePreviewDialogData = {
      patientName: this.store.patient()?.name ?? '',
      sellerName: this.store.seller()?.name ?? '',
      branch: this.store.branch(),
      date: this.store.date(),
      items: this.store.cart().map((line) => ({ label: line.label, kind: line.item.kind, price: line.item.price })),
      total: this.store.total(),
      discount: this.store.discount(),
      discountReason: this.store.discountReason().trim() || null,
      totalWithDiscount: this.store.totalWithDiscount(),
      account: this.store.account(),
      rest: this.store.rest(),
      paymentMethodLabel: method?.label ?? null,
      confirm: () => this.store.confirmSale(),
    };

    const ref = this.dialog.open<SellSnapshot | undefined>(SalePreviewDialog, {
      data,
      role: 'dialog',
      ariaLabelledBy: SALE_PREVIEW_TITLE_ID,
      backdropClass: ['bg-overlay'],
      disableClose: true,
    });
    ref.closed.subscribe((snapshot) => {
      if (snapshot) this.onSaleCreated(snapshot);
    });
  }

  private onSaleCreated(snapshot: SellSnapshot): void {
    this.currentStep.set(1);
    const data: SaleCreatedDialogData = { sale: snapshot.sale, items: snapshot.items };
    const ref = this.dialog.open<SaleCreatedResult>(SaleCreatedDialog, {
      data,
      role: 'dialog',
      ariaLabelledBy: SALE_CREATED_TITLE_ID,
      backdropClass: ['bg-overlay'],
    });
    ref.closed.subscribe((action) => {
      if (action === 'view') {
        void this.router.navigate(['/dashboard/sales-history'], { queryParams: { q: snapshot.sale.folio } });
      }
    });
  }
}
