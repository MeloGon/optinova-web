// C-05 Switch
import { Component, input, output } from '@angular/core';

/**
 * Interruptor on/off (= `Switch` de Flutter/Material). No es un `ControlValueAccessor`: se usa
 * fuera de formularios (ej. Settings · Features), con `[checked]`/`(checkedChange)` directo.
 *
 *   <onv-switch [checked]="feature.value" [disabled]="saving()" (checkedChange)="toggle($event)" />
 */
@Component({
  selector: 'onv-switch',
  template: `
    <button
      type="button"
      role="switch"
      [attr.aria-checked]="checked()"
      [attr.aria-label]="label() || null"
      [disabled]="disabled()"
      (click)="toggle()"
      class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-input bg-muted
             transition-colors duration-(--duration-fast) ease-standard outline-none aria-checked:border-primary
             aria-checked:bg-primary focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed
             disabled:opacity-60"
    >
      <span
        aria-hidden="true"
        class="pointer-events-none inline-block size-4 translate-x-0.5 rounded-full bg-background shadow-sm
               transition-transform duration-(--duration-fast) ease-standard aria-checked:translate-x-[18px]"
        [attr.aria-checked]="checked()"
      ></span>
    </button>
  `,
  host: { class: 'inline-flex' },
})
export class Switch {
  readonly checked = input(false);
  readonly disabled = input(false);
  readonly label = input<string>();

  readonly checkedChange = output<boolean>();

  protected toggle(): void {
    if (!this.disabled()) this.checkedChange.emit(!this.checked());
  }
}
