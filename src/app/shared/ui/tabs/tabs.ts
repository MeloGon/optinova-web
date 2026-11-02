// C-14 Tabs
import { Component, input, output } from '@angular/core';

export interface TabOption {
  value: string;
  label: string;
  /** Si viene, se muestra junto a la etiqueta (ej. "Ventas 4"). */
  count?: number;
}

/**
 * Elegir una de pocas secciones de una misma pantalla (= TabBar de Flutter, pero sin
 * `TabBarView`: el padre decide qué mostrar con `@if` según `active()`, como ya hace
 * `onv-segmented` con el valor elegido). A diferencia de Segmented, esto no es un control de
 * formulario (no implementa `ControlValueAccessor`): navega secciones, no guarda un valor.
 *
 *   <onv-tabs [tabs]="tabs" [active]="tab()" (activeChange)="setTab($event)" />
 */
@Component({
  selector: 'onv-tabs',
  template: `
    @for (tab of tabs(); track tab.value) {
      <button
        type="button"
        role="tab"
        [id]="'tab-' + tab.value"
        [attr.aria-selected]="tab.value === active()"
        [attr.aria-controls]="'tabpanel-' + tab.value"
        [tabIndex]="tab.value === active() ? 0 : -1"
        (click)="activeChange.emit(tab.value)"
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
}
