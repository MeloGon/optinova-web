import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { Dialog } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import {
  LucideEllipsis,
  LucideDynamicIcon,
  LucideKeyRound,
  LucidePlus,
  LucideRefreshCw,
  LucideShieldCheck,
  LucideSquarePen,
  LucideTriangleAlert,
  LucideUserCheck,
  LucideUserX,
  LucideUsers,
} from '@lucide/angular';
import { RouterLink } from '@angular/router';
import { SessionStore } from '../../core/auth/session.store';
import { ManagedUser } from '../../core/models/managed-user';
import { Avatar } from '../../shared/ui/avatar/avatar';
import { Badge, BadgeTone } from '../../shared/ui/badge/badge';
import { ConfirmService } from '../../shared/ui/dialog/confirm.service';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { OnvTable, TableCard } from '../../shared/ui/table/table';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ResetPasswordDialog, ResetPasswordDialogData, RESET_PASSWORD_TITLE_ID } from './components/reset-password-dialog';
import { UserFormDialog, UserFormDialogData, UserFormPayload, USER_FORM_TITLE_ID } from './components/user-form-dialog';
import { UsersStore } from './users.store';

const ROLE_LABELS: Record<ManagedUser['role'], string> = {
  vendedor: 'Vendedor',
  supervisor: 'Supervisor',
  admin: 'Admin',
  megadmin: 'Megadmin',
};
const ROLE_TONES: Record<ManagedUser['role'], BadgeTone> = {
  vendedor: 'neutral',
  supervisor: 'info',
  admin: 'primary',
  megadmin: 'success',
};

/**
 * Settings · Usuarios (= UsersManagementView de Flutter, ampliada: Flutter solo lista y
 * resetea contraseña; acá se agregan crear, editar y activar/desactivar, pedido del dueño).
 * Sin paginar ni filtrar: la lista de usuarios de una óptica es chica. Solo megadmin.
 */
@Component({
  selector: 'app-users-page',
  imports: [RouterLink, DatePipe, LucideDynamicIcon, Avatar, Badge, EmptyState, Skeleton, OnvTable, TableCard, CdkMenu, CdkMenuItem, CdkMenuTrigger],
  providers: [UsersStore],
  templateUrl: './users.page.html',
})
export class UsersPage {
  protected readonly store = inject(UsersStore);
  private readonly session = inject(SessionStore);
  private readonly dialog = inject(Dialog);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly roleLabel = (role: ManagedUser['role']) => ROLE_LABELS[role];
  protected readonly roleTone = (role: ManagedUser['role']) => ROLE_TONES[role];
  protected readonly isSelf = (user: ManagedUser) => user.id === this.session.profile()?.id;

  protected readonly skeletonRows = Array.from({ length: 4 }, (_, i) => i);

  protected readonly icons = {
    users: LucideUsers,
    plus: LucidePlus,
    edit: LucideSquarePen,
    key: LucideKeyRound,
    activate: LucideUserCheck,
    deactivate: LucideUserX,
    audit: LucideShieldCheck,
    more: LucideEllipsis,
    alert: LucideTriangleAlert,
    retry: LucideRefreshCw,
  };

  protected readonly busyUserId = signal<string | null>(null);

  constructor() {
    void this.store.load();
  }

  protected retry(): void {
    void this.store.load();
  }

  protected openNew(): void {
    const data: UserFormDialogData = {
      user: null,
      save: (draft) => this.store.create(draft),
    };
    const ref = this.dialog.open<boolean>(UserFormDialog, {
      data,
      role: 'dialog',
      ariaLabelledBy: USER_FORM_TITLE_ID,
      disableClose: true,
      backdropClass: ['bg-overlay'],
    });
    ref.closed.subscribe((saved) => {
      if (saved) this.toast.show({ tone: 'success', title: 'Usuario creado' });
    });
  }

  protected openEdit(user: ManagedUser): void {
    const data: UserFormDialogData = {
      user,
      disableRoleChange: this.isSelf(user),
      save: (draft: UserFormPayload) => this.store.update(user.id, draft),
    };
    const ref = this.dialog.open<boolean>(UserFormDialog, {
      data,
      role: 'dialog',
      ariaLabelledBy: USER_FORM_TITLE_ID,
      disableClose: true,
      backdropClass: ['bg-overlay'],
    });
    ref.closed.subscribe((saved) => {
      if (saved) this.toast.show({ tone: 'success', title: 'Usuario actualizado' });
    });
  }

  protected openResetPassword(user: ManagedUser): void {
    const data: ResetPasswordDialogData = {
      userName: user.name,
      save: (newPassword) => this.store.resetPassword(user.id, newPassword),
    };
    const ref = this.dialog.open<boolean>(ResetPasswordDialog, {
      data,
      role: 'dialog',
      ariaLabelledBy: RESET_PASSWORD_TITLE_ID,
      disableClose: true,
      backdropClass: ['bg-overlay'],
    });
    ref.closed.subscribe((saved) => {
      if (saved) this.toast.show({ tone: 'success', title: 'Contraseña actualizada' });
    });
  }

  protected async toggleActive(user: ManagedUser): Promise<void> {
    const activating = !user.active;
    if (!activating) {
      const confirmed = await this.confirm.confirm({
        title: '¿Desactivar este usuario?',
        text: `"${user.name}" no podrá iniciar sesión hasta que lo reactives. No se borra nada.`,
        confirmLabel: 'Desactivar',
      });
      if (!confirmed) return;
    }

    this.busyUserId.set(user.id);
    const result = await this.store.setActive(user.id, activating);
    this.busyUserId.set(null);

    if (result.ok) {
      this.toast.show({ tone: 'success', title: activating ? 'Usuario activado' : 'Usuario desactivado' });
    } else {
      this.toast.show({ tone: 'danger', title: 'No se pudo completar', text: result.error.message });
    }
  }
}
