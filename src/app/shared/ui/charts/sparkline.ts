// C-23 Gráficas (mini gráfica de tendencia)
import { Component, computed, input } from '@angular/core';

const W = 100;
const H = 32;
const PAD_Y = 3;

/**
 * Línea de tendencia sin ejes (la que va dentro de una tarjeta KPI). Dibuja los valores de
 * izquierda (más antiguo) a derecha (hoy), con un relleno suave debajo. El SVG se estira al
 * ancho del contenedor; `vector-effect` mantiene el grosor de la línea al estirarse.
 */
@Component({
  selector: 'onv-sparkline',
  template: `
    @if (paths(); as p) {
      <svg
        [attr.viewBox]="'0 0 ' + w + ' ' + h"
        preserveAspectRatio="none"
        class="block h-8 w-full"
        role="img"
        [attr.aria-label]="ariaLabel()"
      >
        <path [attr.d]="p.area" class="fill-chart-1/15" stroke="none" />
        <path
          [attr.d]="p.line"
          class="stroke-chart-1"
          fill="none"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
      </svg>
    }
  `,
  host: { class: 'block' },
})
export class Sparkline {
  readonly values = input.required<number[]>();
  /** Descripción para lectores de pantalla ("Tendencia de ventas de los últimos 7 días"). */
  readonly ariaLabel = input.required<string>();

  protected readonly w = W;
  protected readonly h = H;

  /** Con menos de 2 puntos no hay tendencia que dibujar. */
  protected readonly paths = computed(() => {
    const values = this.values();
    if (values.length < 2) return null;

    // La base es 0 (no el mínimo): una serie que sube de 90 a 100 no debe verse como un salto.
    const max = Math.max(...values, 0);
    const usable = H - PAD_Y * 2;
    const points = values.map((v, i) => ({
      x: (i / (values.length - 1)) * W,
      y: max > 0 ? H - PAD_Y - (Math.max(v, 0) / max) * usable : H - PAD_Y,
    }));

    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
    return { line, area: `${line} L${W} ${H} L0 ${H} Z` };
  });
}
