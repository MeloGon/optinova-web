// C-12 Dialog (confirmación destructiva)
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { LucideDynamicIcon, LucideTriangleAlert } from '@lucide/angular';

export interface ConfirmOptions {
  /** Pregunta con el objeto: "¿Eliminar a ANA LOPEZ?". */
  title: string;
  /** La consecuencia, explícita. */
  text: string;
  /** El verbo exacto del botón: "Eliminar paciente", nunca "Sí". */
  confirmLabel: string;
}

export const CONFIRM_TITLE_ID = 'onv-confirm-title';
export const CONFIRM_TEXT_ID = 'onv-confirm-text';

/**
 * Contenido del diálogo de confirmación. Se abre con `ConfirmService.confirm()`.
 * "Cancelar" va primero y recibe el foco; Esc cancela; el velo no cierra.
 */
@Component({
  selector: 'onv-confirm-dialog',
  imports: [LucideDynamicIcon],
  template: `
    <div class="flex gap-4 p-6">
      <span
        aria-hidden="true"
        class="grid size-10 shrink-0 place-items-center rounded-full bg-danger-subtle text-danger-subtle-foreground"
      >
        <svg [lucideIcon]="icon" [size]="20"></svg>
      </span>
      <div class="min-w-0">
        <h2 [id]="titleId" class="text-heading">{{ options.title }}</h2>
        <p [id]="textId" class="mt-1 text-body text-muted-foreground">{{ options.text }}</p>
      </div>
    </div>
    <div class="flex justify-end gap-2 rounded-b-xl border-t border-border bg-background px-6 py-3">
      <button
        type="button"
        (click)="ref.close(false)"
        class="inline-flex h-(--onv-control-h) items-center rounded-md px-4 text-[14px] font-medium hover:bg-muted"
      >
        Cancelar
      </button>
      <button
        type="button"
        (click)="ref.close(true)"
        class="inline-flex h-(--onv-control-h) items-center rounded-md bg-danger px-4 text-[14px] font-medium text-danger-foreground hover:opacity-90"
      >
        {{ options.confirmLabel }}
      </button>
    </div>
  `,
  host: {
    class: 'block w-[420px] max-w-[calc(100vw-2rem)] rounded-xl bg-card text-card-foreground elev-xl',
    '(keydown.escape)': 'ref.close(false)',
  },
})
export class ConfirmDialog {
  protected readonly options = inject<ConfirmOptions>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly titleId = CONFIRM_TITLE_ID;
  protected readonly textId = CONFIRM_TEXT_ID;
  protected readonly icon = LucideTriangleAlert;
}
