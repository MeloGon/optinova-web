// C-23 Gráficas (barras horizontales de ranking)
import { Component, computed, input } from '@angular/core';
import { Avatar } from '../avatar/avatar';

export interface RankItem {
  label: string;
  /** Lo que mide la barra; la más larga es la de mayor valor. */
  value: number;
  /** El valor ya escrito ("4 unidades", "S/. 8,000.00"). */
  valueLabel: string;
  /** Línea secundaria opcional ("S/. 6,500.00", "5 ventas"). */
  hint?: string;
}

/**
 * Ranking en barras horizontales: una fila por elemento con su posición, nombre, valor y una barra
 * proporcional al mayor. Es una lista ordenada normal (`<ol>`): el valor siempre está escrito, así
 * que no hace falta tabla aparte para lectores de pantalla. Con `avatars`, cada fila lleva las
 * iniciales de la persona (C-19), para rankings de vendedores.
 *
 *   <onv-rank-bars [items]="items" ariaLabel="Armazones más vendidos" />
 */
@Component({
  selector: 'onv-rank-bars',
  imports: [Avatar],
  template: `
    <ol class="flex flex-col gap-3" [attr.aria-label]="ariaLabel()">
      @for (row of rows(); track row.label) {
        <li class="flex items-start gap-3">
          <span class="w-4 shrink-0 pt-0.5 text-right text-caption tabular-nums text-muted-foreground">
            {{ row.position }}
          </span>
          @if (avatars()) {
            <onv-avatar [name]="row.label" size="sm" tone="neutral" [decorative]="true" />
          }
          <div class="min-w-0 flex-1">
            <div class="flex items-baseline justify-between gap-3">
              <span class="min-w-0 truncate text-body font-medium">{{ row.label }}</span>
              <span class="shrink-0 text-body-sm font-medium tabular-nums">{{ row.valueLabel }}</span>
            </div>
            @if (row.hint) {
              <p class="truncate text-caption text-muted-foreground">{{ row.hint }}</p>
            }
            <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div
                class="h-full rounded-full"
                [class]="row.first ? 'bg-chart-1' : 'bg-chart-1/55'"
                [style.width.%]="row.percent"
              ></div>
            </div>
          </div>
        </li>
      }
    </ol>
  `,
})
export class RankBars {
  readonly items = input.required<RankItem[]>();
  /** Descripción de la lista para lectores de pantalla ("Armazones más vendidos del mes"). */
  readonly ariaLabel = input.required<string>();
  readonly avatars = input(false);

  protected readonly rows = computed(() => {
    const items = this.items();
    const max = Math.max(0, ...items.map((i) => i.value));
    return items.map((item, index) => ({
      ...item,
      position: index + 1,
      first: index === 0,
      // Una barra con valor mide al menos 4% para que no desaparezca frente a una enorme.
      percent: max > 0 && item.value > 0 ? Math.max((item.value / max) * 100, 4) : 0,
    }));
  });
}
