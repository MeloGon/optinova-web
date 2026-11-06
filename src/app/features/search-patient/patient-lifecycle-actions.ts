import { Dialog } from '@angular/cdk/dialog';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SessionStore } from '../../core/auth/session.store';
import { AppError } from '../../core/errors/app-error';
import { Patient } from '../../core/models/patient';
import {
  PatientLifecycleResult,
  PatientLifecycleStatus,
  SupervisorCredentials,
} from '../../core/repositories/patient-lifecycle.repository';
import { Result } from '../../core/result';
import { ConfirmService } from '../../shared/ui/dialog/confirm.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { SUPERVISOR_AUTH_TITLE_ID, SupervisorAuthDialog, SupervisorAuthDialogData } from '../../shared/ui/supervisor-auth-dialog/supervisor-auth-dialog';

/** Lo que necesita `askDelete`/`askRestore` de cualquier store que maneje el ciclo de vida del paciente. */
export interface PatientLifecyclePort {
  resolveLifecycle(patientId: string): Promise<Result<PatientLifecycleStatus, AppError>>;
  applyLifecycle(
    patientId: string,
    supervisor?: SupervisorCredentials,
  ): Promise<Result<PatientLifecycleResult, AppError>>;
  restore(patientId: string): Promise<Result<void, AppError>>;
}

/**
 * Eliminar/archivar/restaurar paciente por historial: el flujo de diálogos (confirmar, pedir
 * supervisor, bloquear por rol) es el mismo esté donde esté el botón — hoy en la fila de Buscar
 * paciente, pronto también en el encabezado de la ficha (S-03) — así que vive una sola vez aquí
 * en vez de en cada página. Cada store sigue siendo responsable de refrescar su propio estado
 * (`SearchPatientStore` recarga la lista, por ejemplo); `onDone` es lo extra que haga falta
 * (la ficha, por ejemplo, navega de vuelta a la lista).
 */
@Injectable()
export class PatientLifecycleActions {
  private readonly session = inject(SessionStore);
  private readonly dialog = inject(Dialog);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  async askDelete(patient: Patient, lifecycle: PatientLifecyclePort, onDone: () => void = () => {}): Promise<void> {
    const resolved = await lifecycle.resolveLifecycle(patient.id);
    if (!resolved.ok) {
      this.toast.show({ tone: 'danger', title: 'No se pudo revisar el historial', text: resolved.error.message });
      return;
    }
    const { tier, reviewCount, saleCount } = resolved.value;

    if (tier === 'sales') {
      if (!this.session.can('admin')) {
        this.toast.show({
          tone: 'danger',
          title: 'No se puede eliminar',
          text: 'Tiene ventas registradas: solo un administrador o superior puede archivarlo.',
        });
        return;
      }
      const confirmed = await this.confirm.confirm({
        title: `¿Archivar a ${patient.name}?`,
        text: `Tiene ${saleCount} ${saleCount === 1 ? 'venta' : 'ventas'} registrada${saleCount === 1 ? '' : 's'}: no se puede eliminar, pero sí archivar. Deja de aparecer en búsquedas y en Vender; se puede restaurar después.`,
        confirmLabel: 'Archivar paciente',
        tone: 'primary',
      });
      if (!confirmed) return;
      await this.finish(patient, () => lifecycle.applyLifecycle(patient.id), onDone);
      return;
    }

    if (tier === 'reviews' && !this.session.can('supervisor')) {
      const data: SupervisorAuthDialogData = {
        description: `${patient.name} tiene ${reviewCount} ${reviewCount === 1 ? 'medida' : 'medidas'} registrada${reviewCount === 1 ? '' : 's'}. Se borrarán junto con el paciente.`,
        confirmLabel: 'Autorizar y eliminar',
        authorize: (email, password) => lifecycle.applyLifecycle(patient.id, { email, password }),
      };
      const ref = this.dialog.open<boolean>(SupervisorAuthDialog, {
        data,
        role: 'dialog',
        ariaLabelledBy: SUPERVISOR_AUTH_TITLE_ID,
        disableClose: true,
        backdropClass: ['bg-overlay'],
      });
      if (await firstValueFrom(ref.closed, { defaultValue: false })) {
        this.toast.show({ tone: 'success', title: 'Paciente eliminado', text: patient.name });
        onDone();
      }
      return;
    }

    const text =
      tier === 'reviews'
        ? `Tiene ${reviewCount} ${reviewCount === 1 ? 'medida' : 'medidas'} registrada${reviewCount === 1 ? '' : 's'}: se borrarán junto con el paciente. No se puede deshacer.`
        : 'Se borra el registro del paciente y no se puede deshacer. Sus ventas no se eliminan.';
    const confirmed = await this.confirm.confirm({
      title: `¿Eliminar a ${patient.name}?`,
      text,
      confirmLabel: 'Eliminar paciente',
    });
    if (!confirmed) return;
    await this.finish(patient, () => lifecycle.applyLifecycle(patient.id), onDone);
  }

  async askRestore(patient: Patient, lifecycle: PatientLifecyclePort, onDone: () => void = () => {}): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: `¿Restaurar a ${patient.name}?`,
      text: 'Vuelve a aparecer en búsquedas y en Vender.',
      confirmLabel: 'Restaurar paciente',
      tone: 'primary',
    });
    if (!confirmed) return;

    const result = await lifecycle.restore(patient.id);
    if (result.ok) {
      this.toast.show({ tone: 'success', title: 'Paciente restaurado', text: patient.name });
      onDone();
    } else {
      this.toast.show({ tone: 'danger', title: 'No se pudo restaurar', text: result.error.message });
    }
  }

  private async finish(
    patient: Patient,
    run: () => Promise<Result<PatientLifecycleResult, AppError>>,
    onDone: () => void,
  ): Promise<void> {
    const result = await run();
    if (result.ok) {
      const title = result.value.result === 'archived' ? 'Paciente archivado' : 'Paciente eliminado';
      this.toast.show({ tone: 'success', title, text: patient.name });
      onDone();
    } else {
      this.toast.show({ tone: 'danger', title: 'No se pudo completar', text: result.error.message });
    }
  }
}
