// C-12 Dialog (confirmación destructiva)
import { Dialog } from '@angular/cdk/dialog';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CONFIRM_TEXT_ID, CONFIRM_TITLE_ID, ConfirmDialog, ConfirmOptions } from './confirm-dialog';

/**
 * Pide confirmación antes de una acción destructiva (= showDialog + Future<bool> de Flutter).
 *
 *   if (!(await confirm.confirm({ title, text, confirmLabel }))) return;
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(Dialog);

  async confirm(options: ConfirmOptions): Promise<boolean> {
    const ref = this.dialog.open<boolean, ConfirmOptions, ConfirmDialog>(ConfirmDialog, {
      data: options,
      role: 'alertdialog',
      ariaLabelledBy: CONFIRM_TITLE_ID,
      ariaDescribedBy: CONFIRM_TEXT_ID,
      // Ni el velo ni Esc cierran por defecto: Esc lo maneja el propio diálogo (cancela).
      disableClose: true,
      backdropClass: ['bg-overlay'],
    });
    return (await firstValueFrom(ref.closed, { defaultValue: false })) === true;
  }
}
