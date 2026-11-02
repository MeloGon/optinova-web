import { Dialog } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { LucideDynamicIcon, LucideRefreshCw, LucideSearch, LucideTriangleAlert, LucideUserPlus, LucideX } from '@lucide/angular';
import { Patient } from '../../../core/models/patient';
import { Avatar } from '../../../shared/ui/avatar/avatar';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { RxTable } from '../../../shared/ui/rx-table/rx-table';
import { Skeleton } from '../../../shared/ui/skeleton/skeleton';
import { ADD_PATIENT_TITLE_ID, AddPatientDialog } from '../../search-patient/components/add-patient-dialog';
import { SellStore } from '../sell.store';

/**
 * Paso 1 de Vender (= S-04 paso 1): a la izquierda, buscar al paciente; a la derecha, el
 * paciente elegido con su graduación más reciente. Sin el aviso de saldo pendiente: necesitaría
 * poder buscar ventas por paciente, que `SaleRepository` no ofrece todavía.
 */
@Component({
  selector: 'app-sell-patient-step',
  imports: [ReactiveFormsModule, DatePipe, LucideDynamicIcon, Avatar, EmptyState, Skeleton, RxTable],
  templateUrl: './patient-step.html',
})
export class PatientStep {
  protected readonly store = inject(SellStore);
  private readonly dialog = inject(Dialog);

  protected readonly text = new FormControl('', { nonNullable: true });
  protected readonly icons = {
    search: LucideSearch,
    clear: LucideX,
    userPlus: LucideUserPlus,
    alert: LucideTriangleAlert,
    retry: LucideRefreshCw,
  };
  protected readonly skeletonRows = [0, 1, 2];

  protected submit(): void {
    const query = this.text.value.trim();
    if (query) void this.store.searchPatients(query);
  }

  protected clear(): void {
    this.text.setValue('');
  }

  protected select(patient: Patient): void {
    this.text.setValue('');
    void this.store.selectPatient(patient);
  }

  /** Mismo diálogo de Buscar paciente, pero sin perder el progreso de la venta en curso. */
  protected async addPatient(): Promise<void> {
    const ref = this.dialog.open<Patient | false>(AddPatientDialog, {
      role: 'dialog',
      ariaLabelledBy: ADD_PATIENT_TITLE_ID,
      disableClose: true,
      backdropClass: ['bg-overlay'],
    });
    const result = await firstValueFrom(ref.closed, { defaultValue: false as const });
    if (result) {
      this.text.setValue('');
      void this.store.selectPatient(result);
    }
  }
}
