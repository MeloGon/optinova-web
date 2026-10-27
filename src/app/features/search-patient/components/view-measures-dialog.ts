import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { LucideDynamicIcon, LucideEdit, LucideMapPin, LucideTrash2 } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { AppError } from '../../../core/errors/app-error';
import { Patient } from '../../../core/models/patient';
import { Review } from '../../../core/models/review';
import { Result } from '../../../core/result';
import { Badge } from '../../../shared/ui/badge/badge';
import { ConfirmService } from '../../../shared/ui/dialog/confirm.service';
import { RxTable } from '../../../shared/ui/rx-table/rx-table';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { EDIT_REVIEW_TITLE_ID, EditReviewDialog, EditReviewDialogData } from './edit-review-dialog';

export interface ViewMeasuresDialogData {
  patient: Patient;
  /** Ya cargadas por la página antes de abrir el diálogo (ver `SearchPatientPage.viewMeasures`). */
  reviews: Review[];
  /** Se vuelve a pedir después de editar una medida, para traer el dato tal como quedó guardado. */
  reload: () => Promise<Result<Review[], AppError>>;
  save: (review: Review) => Promise<Result<void, AppError>>;
  remove: (review: Review) => Promise<Result<void, AppError>>;
}

export const VIEW_MEASURES_TITLE_ID = 'view-measures-title';

/**
 * Ver medidas (lista de revisiones de un paciente). = ReviewDetailsDialog de Flutter.
 * "Editar" abre EditReviewDialog encima y, si guarda, recarga la lista; "Eliminar" pide
 * confirmación y la quita de una vez (sin ida y vuelta al servidor).
 */
@Component({
  selector: 'app-view-measures-dialog',
  imports: [DatePipe, LucideDynamicIcon, Badge, RxTable],
  templateUrl: './view-measures-dialog.html',
  host: {
    class: 'block flex max-h-[85vh] w-[640px] max-w-[calc(100vw-2rem)] flex-col rounded-xl bg-card text-card-foreground elev-xl',
    '(keydown.escape)': 'close()',
  },
})
export class ViewMeasuresDialog {
  private readonly data = inject<ViewMeasuresDialogData>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<void>>(DialogRef);
  private readonly dialog = inject(Dialog);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly patient = this.data.patient;
  protected readonly titleId = VIEW_MEASURES_TITLE_ID;
  protected readonly icons = { branch: LucideMapPin, edit: LucideEdit, trash: LucideTrash2 };

  protected readonly reviews = signal<Review[]>(this.data.reviews);

  protected async edit(review: Review): Promise<void> {
    const data: EditReviewDialogData = { review, save: this.data.save };
    const ref = this.dialog.open<boolean>(EditReviewDialog, {
      data,
      role: 'dialog',
      ariaLabelledBy: EDIT_REVIEW_TITLE_ID,
      disableClose: true,
      backdropClass: ['bg-overlay'],
    });
    if (await firstValueFrom(ref.closed, { defaultValue: false })) {
      this.toast.show({ tone: 'success', title: 'Medida actualizada' });
      const result = await this.data.reload();
      if (result.ok) this.reviews.set(result.value);
    }
  }

  protected async remove(review: Review): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: `¿Eliminar la medida del ${formatShortDate(review.date)}?`,
      text: 'No se puede deshacer.',
      confirmLabel: 'Eliminar medida',
    });
    if (!confirmed) return;

    const result = await this.data.remove(review);
    if (result.ok) {
      this.reviews.update((list) => list.filter((r) => r.id !== review.id));
      this.toast.show({ tone: 'success', title: 'Medida eliminada' });
    } else {
      this.toast.show({ tone: 'danger', title: 'No se pudo eliminar', text: result.error.message });
    }
  }

  protected close(): void {
    this.ref.close();
  }
}

/** `yyyy-MM-dd` → `dd/MM/yyyy`, sin depender de Angular (se usa en el título del confirm). */
function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
