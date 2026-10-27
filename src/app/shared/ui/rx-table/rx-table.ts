// P-05 Graduación
import { Component, DestroyRef, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { LucideChevronDown, LucideChevronUp, LucideCopy, LucideDynamicIcon } from '@lucide/angular';
import { formatAxis, formatDiopter, formatText, normalizeDiopterInput, rxTone, stepAxis, stepDiopter } from './rx-format';

export interface RxEyeControls {
  esf: FormControl<string>;
  cil: FormControl<string>;
  eje: FormControl<string>;
  av: FormControl<string>;
}

export interface RxEyeView {
  esf: string;
  cil: string;
  eje: string;
  av: string;
}

export type RxMode = 'view' | 'edit' | 'compact';

/**
 * Tabla de graduación: fila OD (ojo derecho) y OI (ojo izquierdo), columnas ESF, CIL, EJE y AV.
 * ADD y DIP no van aquí: en Flutter y en la DB son un solo valor para toda la medida, no por ojo
 * (se muestran aparte, en "Datos adicionales").
 *
 *   <onv-rx-table mode="view" [odView]="{...}" [oiView]="{...}" />
 *   <onv-rx-table mode="edit" [odControls]="odControls()" [oiControls]="oiControls()" />
 */
@Component({
  selector: 'onv-rx-table',
  imports: [ReactiveFormsModule, LucideDynamicIcon],
  templateUrl: './rx-table.html',
})
export class RxTable {
  readonly mode = input<RxMode>('view');

  // mode="view" | "compact"
  readonly odView = input<RxEyeView>();
  readonly oiView = input<RxEyeView>();

  // mode="edit"
  readonly odControls = input<RxEyeControls>();
  readonly oiControls = input<RxEyeControls>();

  protected readonly icons = { up: LucideChevronUp, down: LucideChevronDown, copy: LucideCopy };

  protected readonly rows = computed(() => [
    { eye: 'OD' as const, solid: true, view: this.odView() },
    { eye: 'OI' as const, solid: false, view: this.oiView() },
  ]);

  /**
   * El estado de un FormControl (touched, errors) no es un signal: sin este contador, `errors()`
   * y el `aria-invalid` de los inputs no se refrescaban en zoneless al marcar touched o validar
   * (hallazgo de Codex, 2026-10-27). Mismo truco que `OnvInput` (shared/ui/field/input.ts).
   */
  private readonly changes = signal(0);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      for (const controls of [this.odControls(), this.oiControls()]) {
        if (!controls) continue;
        for (const control of [controls.esf, controls.cil, controls.eje, controls.av]) {
          control.events.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => this.changes.update((n) => n + 1));
        }
      }
    });
  }

  protected readonly errors = computed(() => {
    this.changes();
    const list: string[] = [];
    for (const [eye, controls] of [
      ['OD', this.odControls()],
      ['OI', this.oiControls()],
    ] as const) {
      const eje = controls?.eje;
      if (eje?.invalid && (eje.touched || eje.dirty)) {
        list.push(`${eye} · EJE: debe estar entre 0 y 180.`);
      }
    }
    return list;
  });

  protected readonly formatDiopter = formatDiopter;
  protected readonly formatAxis = formatAxis;
  protected readonly formatText = formatText;
  protected readonly rxTone = rxTone;

  protected normalizeDiopter(control: FormControl<string>): void {
    control.setValue(normalizeDiopterInput(control.value));
  }

  protected stepEsfCil(control: FormControl<string>, delta: number): void {
    control.setValue(stepDiopter(control.value, delta));
    control.markAsDirty();
  }

  protected stepEje(control: FormControl<string>, delta: number): void {
    control.setValue(stepAxis(control.value, delta));
    control.markAsDirty();
  }

  protected copyOdToOi(): void {
    const od = this.odControls();
    const oi = this.oiControls();
    if (!od || !oi) return;
    oi.esf.setValue(od.esf.value);
    oi.cil.setValue(od.cil.value);
    oi.eje.setValue(od.eje.value);
    oi.av.setValue(od.av.value);
    oi.esf.markAsDirty();
    oi.cil.markAsDirty();
    oi.eje.markAsDirty();
    oi.av.markAsDirty();
  }
}
