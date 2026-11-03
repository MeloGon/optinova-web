// C-23 Gráficas (dona)
import { Component, computed, input } from '@angular/core';

export interface DonutSlice {
  label: string;
  value: number;
  /** Color CSS; si falta se toma `--color-chart-N` según la posición. */
  color?: string;
}

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SERIES = 6;

/** Color por defecto de la posición `index` (los tokens chart-1..6 se repiten si hay más porciones). */
export const sliceColor = (index: number): string => `var(--color-chart-${(index % SERIES) + 1})`;

/**
 * Dona en SVG con su leyenda al lado (nombre, valor y %). El total va al centro.
 * Cada porción es un arco de círculo (`stroke-dasharray`), sin librería.
 */
@Component({
  selector: 'onv-donut-chart',
  template: `
    <div class="flex flex-wrap items-center gap-x-6 gap-y-4">
      <svg viewBox="0 0 100 100" class="size-36 shrink-0" role="img" [attr.aria-label]="ariaLabel()">
        <circle cx="50" cy="50" [attr.r]="radius" fill="none" class="stroke-muted" stroke-width="14" />
        @for (a of arcs(); track a.label) {
          <circle
            cx="50"
            cy="50"
            [attr.r]="radius"
            fill="none"
            stroke-width="14"
            [attr.stroke]="a.color"
            [attr.stroke-dasharray]="a.dash + ' ' + circumference"
            [attr.stroke-dashoffset]="a.offset"
            transform="rotate(-90 50 50)"
          >
            <title>{{ a.label }}: {{ format()(a.value) }} ({{ a.percent }}%)</title>
          </circle>
        }
        <text x="50" y="48" text-anchor="middle" class="fill-muted-foreground" font-size="6.5">
          {{ centerLabel() }}
        </text>
        <text x="50" y="58" text-anchor="middle" class="fill-foreground" font-size="9" font-weight="700">
          {{ format()(total()) }}
        </text>
      </svg>

      <ul class="flex min-w-[180px] flex-1 flex-col gap-2 text-body-sm">
        @for (a of arcs(); track a.label) {
          <li class="flex items-center gap-2">
            <span class="size-2.5 shrink-0 rounded-full" [style.background-color]="a.color" aria-hidden="true"></span>
            <span class="min-w-0 flex-1 truncate">{{ a.label }}</span>
            <span class="tabular-nums text-muted-foreground">{{ a.percent }}%</span>
            <span class="w-24 text-right font-medium tabular-nums">{{ format()(a.value) }}</span>
          </li>
        }
      </ul>
    </div>
  `,
})
export class DonutChart {
  readonly slices = input.required<DonutSlice[]>();
  readonly ariaLabel = input.required<string>();
  /** Texto pequeño sobre el total del centro ("Total"). */
  readonly centerLabel = input('Total');
  readonly format = input<(n: number) => string>((n) => String(n));

  protected readonly radius = RADIUS;
  protected readonly circumference = CIRCUMFERENCE;

  protected readonly total = computed(() => this.slices().reduce((sum, s) => sum + s.value, 0));

  protected readonly arcs = computed(() => {
    const total = this.total();
    let acc = 0;
    return this.slices()
      .filter((s) => s.value > 0)
      .map((s, i) => {
        const fraction = total > 0 ? s.value / total : 0;
        const arc = {
          label: s.label,
          value: s.value,
          color: s.color ?? sliceColor(i),
          percent: Math.round(fraction * 100),
          dash: fraction * CIRCUMFERENCE,
          offset: -acc * CIRCUMFERENCE,
        };
        acc += fraction;
        return arc;
      });
  });
}
