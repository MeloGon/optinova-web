// C-22 Stepper
import { Component, computed, input, output } from '@angular/core';
import { LucideCheck, LucideDynamicIcon, LucideX } from '@lucide/angular';

export type StepState = 'upcoming' | 'current' | 'complete' | 'error';

export interface Step {
  label: string;
  /** Resumen de lo elegido ("María F. Quispe Huamán"); se oculta en mobile. */
  hint: string;
  state: StepState;
}

const DOT_CLASSES: Record<StepState, string> = {
  upcoming: 'border border-input text-muted-foreground',
  current: 'border-2 border-primary bg-primary-subtle text-primary-subtle-foreground',
  complete: 'bg-primary text-primary-foreground',
  error: 'bg-danger-subtle text-danger-subtle-foreground',
};

const BAR_CLASSES: Record<StepState, string> = {
  upcoming: 'bg-border',
  current: 'bg-border',
  complete: 'bg-primary',
  error: 'bg-border',
};

/**
 * Indicador de progreso de un flujo de varios pasos (= C-22 de Claude Design; `CdkStepper` lineal
 * con cabecera propia en Angular). Solo se puede volver a un paso ya completo.
 *
 *   <onv-stepper [steps]="steps()" (stepClick)="goTo($event)" />
 */
@Component({
  selector: 'onv-stepper',
  imports: [LucideDynamicIcon],
  templateUrl: './stepper.html',
  host: { class: 'block' },
})
export class Stepper {
  readonly steps = input.required<Step[]>();
  readonly stepClick = output<number>();

  protected readonly checkIcon = LucideCheck;
  protected readonly errorIcon = LucideX;

  protected readonly current = computed(() => {
    const i = this.steps().findIndex((s) => s.state === 'current');
    return i === -1 ? this.steps().length : i + 1;
  });

  protected dotClasses(state: StepState): string {
    return DOT_CLASSES[state];
  }

  protected barClasses(state: StepState): string {
    return BAR_CLASSES[state];
  }

  protected onClick(index: number, state: StepState): void {
    if (state === 'complete') this.stepClick.emit(index);
  }
}
