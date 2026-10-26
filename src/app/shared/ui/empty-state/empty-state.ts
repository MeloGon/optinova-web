// C-18 Empty state
import { Component, input } from '@angular/core';
import { LucideDynamicIcon, LucideIconInput } from '@lucide/angular';

/**
 * Mensaje que ocupa el lugar de una lista vacía y dice qué hacer a continuación.
 * Los botones (máx. 2) se proyectan dentro:
 *
 *   <onv-empty-state [icon]="i" title="Sin resultados" text="No encontramos «ana».">
 *     <button ...>Limpiar búsqueda</button>
 *   </onv-empty-state>
 */
@Component({
  selector: 'onv-empty-state',
  imports: [LucideDynamicIcon],
  template: `
    <span
      aria-hidden="true"
      class="grid size-16 place-items-center rounded-full border-[1.5px] border-dashed border-border-strong bg-muted text-muted-foreground"
    >
      <svg [lucideIcon]="icon()" [size]="24"></svg>
    </span>
    <h3 class="text-[15px] leading-[22px] font-semibold">{{ title() }}</h3>
    @if (text(); as t) {
      <p class="max-w-[340px] text-body-sm text-muted-foreground">{{ t }}</p>
    }
    <div class="mt-1 flex flex-wrap justify-center gap-2 empty:hidden">
      <ng-content />
    </div>
  `,
  host: { class: 'flex flex-col items-center gap-2 px-6 py-12 text-center' },
})
export class EmptyState {
  readonly icon = input.required<LucideIconInput>();
  readonly title = input.required<string>();
  readonly text = input<string>();
}
