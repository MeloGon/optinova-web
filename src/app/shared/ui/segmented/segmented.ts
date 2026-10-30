// C-06 Segmented control
import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SegmentedOption {
  value: string;
  label: string;
  /** Si viene, se muestra junto a la etiqueta (ej. "Con saldo 14"). */
  count?: number;
}

/**
 * Elegir una opción entre pocas, a la vista (= GenderToggle de Flutter). Funciona con
 * `formControlName`; con `clearable` volver a pulsar la opción elegida la quita.
 *
 *   <onv-segmented formControlName="gender" label="Género" [options]="genders" [clearable]="true" />
 */
@Component({
  selector: 'onv-segmented',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => Segmented), multi: true }],
  template: `
    @for (option of options(); track option.value) {
      <button
        type="button"
        role="radio"
        [attr.aria-checked]="option.value === value()"
        [disabled]="disabled()"
        (click)="choose(option.value)"
        class="inline-flex h-[calc(var(--onv-control-h)-6px)] items-center gap-1.5 rounded-sm px-4 text-body-sm font-medium text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:text-disabled-foreground aria-checked:bg-primary-subtle aria-checked:text-primary-subtle-foreground"
      >
        {{ option.label }}
        @if (option.count != null) {
          <span class="text-caption tabular-nums opacity-70">{{ option.count }}</span>
        }
      </button>
    }
  `,
  host: {
    role: 'radiogroup',
    '[attr.aria-label]': 'label()',
    class: 'inline-flex w-fit gap-0.5 rounded-md border border-input bg-input-background p-0.5',
  },
})
export class Segmented implements ControlValueAccessor {
  readonly options = input.required<SegmentedOption[]>();
  /** Nombre del grupo para lectores de pantalla. */
  readonly label = input.required<string>();
  readonly clearable = input(false);

  protected readonly value = signal('');
  protected readonly disabled = signal(false);

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  protected choose(value: string): void {
    const next = this.clearable() && value === this.value() ? '' : value;
    this.value.set(next);
    this.onChange(next);
    this.onTouched();
  }

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }
}
