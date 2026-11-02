// C-14 Tabs
import { Component, ElementRef, input, output, viewChildren } from '@angular/core';

export interface TabOption {
  value: string;
  label: string;
  /** Si viene, se muestra junto a la etiqueta (ej. "Ventas 4"). */
  count?: number;
}

/** Ids previsibles para que la página marque su panel con `role="tabpanel"` y los dos queden enlazados. */
export const tabId = (value: string): string => `tab-${value}`;
export const tabPanelId = (value: string): string => `tabpanel-${value}`;

/**
 * Elegir una de pocas secciones de una misma pantalla (= TabBar de Flutter, pero sin
 * `TabBarView`: el padre decide qué mostrar con `@if` según `active()`, como ya hace
 * `onv-segmented` con el valor elegido). A diferencia de Segmented, esto no es un control de
 * formulario (no implementa `ControlValueAccessor`): navega secciones, no guarda un valor.
 *
 * Teclado (patrón WAI-ARIA Tabs, "activación automática"): ←/→ mueve el foco y elige la pestaña
 * vecina (cíclico); Inicio/Fin van a la primera/última. El padre debe marcar su contenido con
 * `[id]="tabPanelId(value)"` y `role="tabpanel"` para que `aria-controls` apunte a algo real.
 *
 *   <onv-tabs [tabs]="tabs" [active]="tab()" (activeChange)="setTab($event)" />
 *   <div [id]="tabPanelId('reviews')" role="tabpanel" [attr.aria-labelledby]="tabId('reviews')">...</div>
 */
@Component({
  selector: 'onv-tabs',
  template: `
    @for (tab of tabs(); track tab.value) {
      <button
        #tabButton
        type="button"
        role="tab"
        [id]="tabId(tab.value)"
        [attr.aria-selected]="tab.value === active()"
        [attr.aria-controls]="tabPanelId(tab.value)"
        [tabIndex]="tab.value === active() ? 0 : -1"
        (click)="activeChange.emit(tab.value)"
        (keydown)="onKeydown($event, tab.value)"
        class="relative flex h-10 items-center gap-1.5 px-1 text-body-sm font-medium text-muted-foreground outline-none hover:text-foreground aria-selected:text-foreground"
      >
        {{ tab.label }}
        @if (tab.count != null) {
          <span class="text-caption tabular-nums opacity-70">{{ tab.count }}</span>
        }
        @if (tab.value === active()) {
          <span class="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" aria-hidden="true"></span>
        }
      </button>
    }
  `,
  host: {
    role: 'tablist',
    class: 'flex items-center gap-6 border-b border-border',
  },
})
export class Tabs {
  readonly tabs = input.required<TabOption[]>();
  readonly active = input.required<string>();
  readonly activeChange = output<string>();

  protected readonly tabId = tabId;
  protected readonly tabPanelId = tabPanelId;

  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');

  protected onKeydown(event: KeyboardEvent, current: string): void {
    const list = this.tabs();
    const index = list.findIndex((t) => t.value === current);
    const lastIndex = list.length - 1;

    let next: number | null = null;
    if (event.key === 'ArrowRight') next = index === lastIndex ? 0 : index + 1;
    else if (event.key === 'ArrowLeft') next = index === 0 ? lastIndex : index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = lastIndex;
    if (next === null) return;

    event.preventDefault();
    this.activeChange.emit(list[next].value);
    this.buttons()[next]?.nativeElement.focus();
  }
}
