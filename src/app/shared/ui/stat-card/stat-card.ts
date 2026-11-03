// C-10 Stat card (KPI)
import { Component, computed, input } from '@angular/core';
import {
  LucideDynamicIcon,
  LucideIconInput,
  LucideMinus,
  LucideTrendingDown,
  LucideTrendingUp,
} from '@lucide/angular';
import { Badge, BadgeTone } from '../badge/badge';
import { Sparkline } from '../charts/sparkline';

export type StatTone = 'primary' | 'success' | 'warning' | 'info';

const TONES: Record<StatTone, string> = {
  primary: 'bg-primary-subtle text-primary-subtle-foreground',
  success: 'bg-success-subtle text-success-subtle-foreground',
  warning: 'bg-warning-subtle text-warning-subtle-foreground',
  info: 'bg-info-subtle text-info-subtle-foreground',
};

/** Cambio frente al periodo anterior, ya calculado por quien usa la tarjeta. */
export interface StatVariation {
  percent: number;
  direction: 'up' | 'down' | 'flat';
}

/**
 * Tarjeta de un indicador: etiqueta, valor grande, variación opcional y mini gráfica opcional.
 *
 *   <onv-stat-card label="Ingresos" [value]="'S/. 3,200.00'" [icon]="i" tone="success"
 *     [variation]="v" compareLabel="vs ayer" [series]="[0, 120, 300]" caption="Pagos cobrados hoy" />
 *
 * `variation` distingue tres casos: sin definir = la tarjeta no se compara (un saldo, un conteo);
 * `null` = se compara pero no hay base ("sin comparación"); un valor = sube, baja o igual.
 */
@Component({
  selector: 'onv-stat-card',
  imports: [LucideDynamicIcon, Badge, Sparkline],
  template: `
    <div class="flex items-center justify-between gap-2">
      <span class="text-body-sm font-medium text-muted-foreground">{{ label() }}</span>
      <span [class]="toneClass()">
        <svg [lucideIcon]="icon()" [size]="16"></svg>
      </span>
    </div>

    <p class="mt-3 text-[24px] font-bold tabular-nums">{{ value() }}</p>

    @if (variation() !== undefined) {
      <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
        @if (variation(); as v) {
          <onv-badge [tone]="badgeTone()" [icon]="badgeIcon()">
            <span class="sr-only">{{ directionText() }}</span>{{ v.percent }}%
          </onv-badge>
          {{ compareLabel() }}
        } @else {
          Sin comparación {{ compareLabel() }}
        }
      </p>
    }
    @if (caption(); as c) {
      <p class="text-caption text-muted-foreground">{{ c }}</p>
    }

    @if (series(); as s) {
      @if (s.length > 1) {
        <onv-sparkline class="mt-3" [values]="s" [ariaLabel]="seriesLabel()" />
      }
    }
  `,
  host: { class: 'block rounded-lg border border-border bg-card p-5 elev-sm' },
})
export class StatCard {
  readonly label = input.required<string>();
  /** Valor ya formateado ("S/. 1,250.00", "36"). */
  readonly value = input.required<string>();
  readonly icon = input.required<LucideIconInput>();
  readonly tone = input<StatTone>('primary');
  readonly caption = input<string>();
  readonly variation = input<StatVariation | null>();
  /** "vs ayer", "vs el mes anterior"... Se muestra junto a la variación. */
  readonly compareLabel = input('');
  readonly series = input<number[] | null>();
  readonly seriesLabel = input('Tendencia');

  protected readonly toneClass = computed(() => `grid size-8 place-items-center rounded-md ${TONES[this.tone()]}`);

  protected readonly badgeTone = computed<BadgeTone>(() => {
    const direction = this.variation()?.direction;
    return direction === 'up' ? 'success' : direction === 'down' ? 'danger' : 'neutral';
  });

  /** Flecha + porcentaje: el color nunca va solo (regla del sistema de diseño). */
  protected readonly badgeIcon = computed<LucideIconInput>(() => {
    const direction = this.variation()?.direction;
    return direction === 'up' ? LucideTrendingUp : direction === 'down' ? LucideTrendingDown : LucideMinus;
  });

  protected readonly directionText = computed(() => {
    const direction = this.variation()?.direction;
    return direction === 'up' ? 'Sube ' : direction === 'down' ? 'Baja ' : 'Igual ';
  });
}
