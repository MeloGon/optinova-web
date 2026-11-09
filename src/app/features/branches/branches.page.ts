import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { Dialog } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import {
  LucideBuilding2,
  LucideDynamicIcon,
  LucideEllipsis,
  LucideLock,
  LucideLockOpen,
  LucidePlus,
  LucideRefreshCw,
  LucideSquarePen,
  LucideStore,
  LucideTriangleAlert,
} from '@lucide/angular';
import { SessionStore } from '../../core/auth/session.store';
import { CompanyBranchesService } from '../../core/config/company-branches.service';
import { ManagedBranch } from '../../core/models/managed-branch';
import { Badge } from '../../shared/ui/badge/badge';
import { ConfirmService } from '../../shared/ui/dialog/confirm.service';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { OnvTable, TableCard } from '../../shared/ui/table/table';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { BRANCH_FORM_TITLE_ID, BranchFormDialog, BranchFormDialogData } from './components/branch-form-dialog';
import { COMPANY_WIZARD_TITLE_ID, CompanyWizardDialog, CompanyWizardDialogData } from './components/company-wizard-dialog';
import { BranchesStore, CompanyGroup } from './branches.store';

/**
 * Settings · Sucursales (sin equivalente en Flutter: allá eran un enum fijo). Un admin ve y
 * administra las sucursales de su empresa; un megadmin ve las de todas (agrupadas) y además puede
 * dar de alta una empresa nueva. Cerrar no borra: la sucursal sigue en filtros e historial.
 */
@Component({
  selector: 'app-branches-page',
  imports: [LucideDynamicIcon, Badge, EmptyState, Skeleton, OnvTable, TableCard, CdkMenu, CdkMenuItem, CdkMenuTrigger],
  providers: [BranchesStore],
  templateUrl: './branches.page.html',
})
export class BranchesPage {
  protected readonly store = inject(BranchesStore);
  private readonly session = inject(SessionStore);
  private readonly companyBranches = inject(CompanyBranchesService);
  private readonly dialog = inject(Dialog);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly isMegadmin = this.session.can('megadmin');
  protected readonly skeletonRows = Array.from({ length: 3 }, (_, i) => i);
  protected readonly busyBranchId = signal<number | null>(null);

  protected readonly icons = {
    store: LucideStore,
    company: LucideBuilding2,
    plus: LucidePlus,
    edit: LucideSquarePen,
    close: LucideLock,
    reopen: LucideLockOpen,
    more: LucideEllipsis,
    alert: LucideTriangleAlert,
    retry: LucideRefreshCw,
  };

  constructor() {
    void this.store.load();
  }

  protected retry(): void {
    void this.store.load();
  }

  protected openNew(group: CompanyGroup): void {
    const data: BranchFormDialogData = {
      branch: null,
      companyName: group.companyName,
      save: async (name) => this.refreshed(await this.store.create(name, group.companyId)),
    };
    this.dialog
      .open<number | null>(BranchFormDialog, this.dialogConfig(data, BRANCH_FORM_TITLE_ID))
      .closed.subscribe((elapsedMs) => {
        if (elapsedMs !== null && elapsedMs !== undefined) this.toast.show({ tone: 'success', title: 'Sucursal creada' });
      });
  }

  protected openRename(branch: ManagedBranch): void {
    const data: BranchFormDialogData = {
      branch,
      companyName: branch.companyName,
      save: async (name) => this.refreshed(await this.store.update(branch.id, { name })),
    };
    this.dialog
      .open<number | null>(BranchFormDialog, this.dialogConfig(data, BRANCH_FORM_TITLE_ID))
      .closed.subscribe((elapsedMs) => {
        if (elapsedMs === null || elapsedMs === undefined || elapsedMs === 0) return;
        this.toast.show({
          tone: 'success',
          title: 'Sucursal renombrada',
          text: `El historial se actualizó en ${(elapsedMs / 1000).toFixed(1)} s.`,
        });
      });
  }

  protected openNewCompany(): void {
    const data: CompanyWizardDialogData = { save: (draft) => this.store.createCompany(draft) };
    this.dialog
      .open<boolean>(CompanyWizardDialog, this.dialogConfig(data, COMPANY_WIZARD_TITLE_ID))
      .closed.subscribe((saved) => {
        if (saved) this.toast.show({ tone: 'success', title: 'Empresa creada', text: 'Ya puede entrar su administrador.' });
      });
  }

  protected async toggleActive(branch: ManagedBranch): Promise<void> {
    const reopening = !branch.active;
    if (!reopening) {
      const confirmed = await this.confirm.confirm({
        title: '¿Cerrar esta sucursal?',
        text: `"${branch.name}" dejará de ofrecerse al crear ventas, pacientes y revisiones nuevas. Su historial se conserva y puedes reabrirla.`,
        confirmLabel: 'Cerrar sucursal',
      });
      if (!confirmed) return;
    }

    this.busyBranchId.set(branch.id);
    const result = this.refreshed(await this.store.update(branch.id, { active: reopening }));
    this.busyBranchId.set(null);

    if (result.ok) {
      this.toast.show({ tone: 'success', title: reopening ? 'Sucursal reabierta' : 'Sucursal cerrada' });
    } else {
      this.toast.show({ tone: 'danger', title: 'No se pudo completar', text: result.error.message });
    }
  }

  /** Tras un cambio, los selectores del resto de la app deben ver las sucursales nuevas. */
  private refreshed<T extends { ok: boolean }>(result: T): T {
    if (result.ok) void this.companyBranches.reload();
    return result;
  }

  private dialogConfig(data: unknown, titleId: string) {
    return {
      data,
      role: 'dialog' as const,
      ariaLabelledBy: titleId,
      disableClose: true,
      backdropClass: ['bg-overlay'],
    };
  }
}
