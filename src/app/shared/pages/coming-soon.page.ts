import { Component, input } from '@angular/core';
import { LucideConstruction, LucideDynamicIcon } from '@lucide/angular';

/**
 * Página provisional de una feature que aún no se migra.
 * Recibe `title` y `delivery` del `data` de la ruta (withComponentInputBinding).
 */
@Component({
  selector: 'app-coming-soon-page',
  imports: [LucideDynamicIcon],
  template: `
    <div class="grid min-h-full place-items-center p-6">
      <div class="flex max-w-sm flex-col items-center gap-3 text-center">
        <span class="grid size-12 place-items-center rounded-full bg-primary-subtle text-primary-subtle-foreground">
          <svg [lucideIcon]="icon" [size]="20"></svg>
        </span>
        <h2 class="text-heading">{{ title() }} está en construcción</h2>
        <p class="text-body-sm text-muted-foreground">
          Mientras tanto, sigue usando la app actual. Esta pantalla se migra en el entregable {{ delivery() }}.
        </p>
      </div>
    </div>
  `,
})
export class ComingSoonPage {
  readonly title = input('');
  readonly delivery = input('');
  protected readonly icon = LucideConstruction;
}
