// C-11 Badge
import { Component, computed, input } from '@angular/core';
import { LucideDynamicIcon, LucideIconInput } from '@lucide/angular';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'info' | 'danger' | 'outline';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary-subtle text-primary-subtle-foreground',
  success: 'bg-success-subtle text-success-subtle-foreground',
  warning: 'bg-warning-subtle text-warning-subtle-foreground',
  info: 'bg-info-subtle text-info-subtle-foreground',
  danger: 'bg-danger-subtle text-danger-subtle-foreground',
  outline: 'border border-border-strong text-foreground',
};

/**
 * Etiqueta corta de estado, rol o sucursal; nunca es interactiva. El color nunca va solo:
 * lleva texto y, si hace falta, un ícono.
 *
 *   <onv-badge tone="outline" [icon]="pinIcon">OFTALVISION</onv-badge>
 *
 * Con `label` se lee "etiqueta valor": la etiqueta tenue y el valor en negrita.
 *
 *   <onv-badge label="Sucursal" tone="outline" [icon]="pinIcon">OFTALVISION</onv-badge>
 */
@Component({
  selector: 'onv-badge',
  imports: [LucideDynamicIcon],
  template: `
    @if (icon(); as i) {
      <svg [lucideIcon]="i" [size]="12" class="shrink-0"></svg>
    }
    @if (label(); as l) {
      <span class="opacity-70">{{ l }}</span>
    }
    <span [class.font-semibold]="!!label()"><ng-content /></span>
  `,
  host: { '[class]': 'classes()' },
})
export class Badge {
  readonly tone = input<BadgeTone>('neutral');
  readonly icon = input<LucideIconInput>();
  /** Nombre del dato ("Sucursal", "Registro"); el valor va como contenido. */
  readonly label = input<string>();

  protected readonly classes = computed(
    () => `inline-flex h-[22px] items-center gap-1 rounded-full px-2 text-caption whitespace-nowrap ${TONES[this.tone()]}`,
  );
}
