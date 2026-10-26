// C-02 Input
import { Component, contentChild, input } from '@angular/core';
import { LucideCircleAlert, LucideDynamicIcon } from '@lucide/angular';
import { OnvInput } from './input';

/**
 * Etiqueta, control y mensaje (ayuda o error) de un campo de formulario.
 * La etiqueta es siempre visible; el error lleva ícono y texto, nunca solo color.
 */
@Component({
  selector: 'onv-field',
  imports: [LucideDynamicIcon],
  template: `
    <label [attr.for]="inputId()" class="text-label">
      {{ label() }}
      @if (required()) {
        <span aria-hidden="true" class="text-danger-subtle-foreground">*</span>
      }
    </label>
    <ng-content />
    @if (errorMessage(); as message) {
      <p class="flex items-center gap-1 text-body-sm text-danger-subtle-foreground">
        <svg [lucideIcon]="alertIcon" [size]="14" class="shrink-0"></svg>
        {{ message }}
      </p>
    } @else if (hint(); as text) {
      <p class="text-body-sm text-muted-foreground">{{ text }}</p>
    }
  `,
  host: { class: 'flex flex-col gap-1.5' },
})
export class Field {
  readonly label = input.required<string>();
  /** `id` del control proyectado: enlaza la etiqueta con él. */
  readonly inputId = input.required<string>();
  readonly required = input(false);
  readonly hint = input<string>();
  /** Texto por validador: `{ required: 'Escribe el nombre.' }`. */
  readonly errors = input<Record<string, string>>({});

  private readonly control = contentChild(OnvInput);

  protected readonly alertIcon = LucideCircleAlert;

  // Se evalúa en cada revisión de la vista: el estado del control (touched, errors) no es un signal.
  protected errorMessage(): string | null {
    const key = this.control()?.errorKey();
    return key ? (this.errors()[key] ?? 'El valor no es válido.') : null;
  }
}
