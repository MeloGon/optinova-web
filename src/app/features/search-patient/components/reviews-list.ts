import { Dialog } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { LucideClipboardList, LucideDynamicIcon, LucideEdit, LucideMapPin, LucideTrash2 } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { AppError } from '../../../core/errors/app-error';
import { Review } from '../../../core/models/review';
import { Result } from '../../../core/result';
import { Badge } from '../../../shared/ui/badge/badge';
import { ConfirmService } from '../../../shared/ui/dialog/confirm.service';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { RxTable } from '../../../shared/ui/rx-table/rx-table';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { EDIT_REVIEW_TITLE_ID, EditReviewDialog, EditReviewDialogData } from './edit-review-dialog';

/**
 * Lista de medidas de un paciente (= el cuerpo de `ViewMeasuresDialog`, pero como componente para
 * la pestaña Revisiones de la ficha en vez de un diálogo propio). Sin estado interno: `reviews`
 * es la fuente de verdad del store del que la use, y después de editar/eliminar se pide `reload`
 * para traerla al día (el store ya decide cómo).
 *
 *   <app-reviews-list [reviews]="store.reviews()" [save]="..." [remove]="..." [reload]="..." />
 */
@Component({
  selector: 'app-reviews-list',
  imports: [DatePipe, LucideDynamicIcon, Badge, EmptyState, RxTable],
  templateUrl: './reviews-list.html',
})
export class ReviewsList {
  private readonly dialog = inject(Dialog);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly reviews = input.required<Review[]>();
  readonly save = input.required<(review: Review) => Promise<Result<void, AppError>>>();
  readonly remove = input.required<(review: Review) => Promise<Result<void, AppError>>>();
  readonly reload = input.required<() => Promise<void>>();

  protected readonly icons = {
    branch: LucideMapPin,
    edit: LucideEdit,
    trash: LucideTrash2,
    empty: LucideClipboardList,
  };

  protected async edit(review: Review): Promise<void> {
    const data: EditReviewDialogData = { review, save: this.save() };
    const ref = this.dialog.open<boolean>(EditReviewDialog, {
      data,
      role: 'dialog',
      ariaLabelledBy: EDIT_REVIEW_TITLE_ID,
      disableClose: true,
      backdropClass: ['bg-overlay'],
    });
    if (await firstValueFrom(ref.closed, { defaultValue: false })) {
      this.toast.show({ tone: 'success', title: 'Medida actualizada' });
      await this.reload()();
    }
  }

  protected async removeReview(review: Review): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: `¿Eliminar la medida del ${formatShortDate(review.date)}?`,
      text: 'No se puede deshacer.',
      confirmLabel: 'Eliminar medida',
    });
    if (!confirmed) return;

    const result = await this.remove()(review);
    if (result.ok) {
      this.toast.show({ tone: 'success', title: 'Medida eliminada' });
      await this.reload()();
    } else {
      this.toast.show({ tone: 'danger', title: 'No se pudo eliminar', text: result.error.message });
    }
  }
}

/** `yyyy-MM-dd` → `dd/MM/yyyy`, sin depender de Angular (se usa en el título del confirm). */
function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
