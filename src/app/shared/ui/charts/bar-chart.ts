// C-23 Gráficas (barras)
import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal } from '@angular/core';

export interface BarDatum {
  label: string;
  value: number;
}

/** Sube `max` a un tope "redondo" (1, 2, 5 × 10ⁿ) para que las líneas guía caigan en números limpios. */
export function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const n = max / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

const HEIGHT = 220;
const PAD = { top: 12, right: 8, bottom: 28, left: 8 };
/** Ancho de partida (antes de medir) y mínimo, para que las barras nunca queden ilegibles. */
const DEFAULT_WIDTH = 560;
const MIN_WIDTH = 280;
/** Ancho mínimo que necesita una etiqueta ("vie 30") para no pisar a la vecina. */
const LABEL_SLOT = 44;

/**
 * Barras verticales dibujadas en SVG (sin librería). Hereda colores de los tokens del tema,
 * así que sigue al primario y al modo oscuro. La última barra (hoy) va en el color pleno.
 * `<title>` da el valor al pasar el mouse y la tabla `sr-only` lo da a lectores de pantalla.
 *
 * El alto es fijo y el ancho se mide (ResizeObserver): así el texto y las barras conservan su
 * tamaño real en vez de escalarse junto con el contenedor, como pasa con un viewBox fijo.
 */
@Component({
  selector: 'onv-bar-chart',
  host: { class: 'block' },
  template: `
    <svg
      [attr.viewBox]="'0 0 ' + width() + ' ' + height"
      [attr.width]="width()"
      [attr.height]="height"
      class="block max-w-full"
      role="img"
      [attr.aria-label]="ariaLabel()"
    >
      @for (g of guides(); track g.y) {
        <line
          [attr.x1]="pad.left"
          [attr.x2]="width() - pad.right"
          [attr.y1]="g.y"
          [attr.y2]="g.y"
          class="stroke-border"
          stroke-width="1"
          [attr.stroke-dasharray]="g.base ? null : '3 4'"
        />
      }
      @for (b of bars(); track b.index) {
        <g>
          <title>{{ b.label }}: {{ format()(b.value) }}</title>
          <rect
            [attr.x]="b.x"
            [attr.y]="b.y"
            [attr.width]="b.w"
            [attr.height]="b.h"
            rx="4"
            [class]="b.last ? 'fill-chart-1' : 'fill-chart-1/55'"
          />
          @if (b.showLabel) {
            <text
              [attr.x]="b.x + b.w / 2"
              [attr.y]="height - 8"
              text-anchor="middle"
              class="fill-muted-foreground"
              font-size="12"
            >
              {{ b.label }}
            </text>
          }
        </g>
      }
    </svg>
    <table class="sr-only">
      <caption>
        {{ ariaLabel() }}
      </caption>
      <tbody>
        @for (d of data(); track d.label) {
          <tr>
            <th scope="row">{{ d.label }}</th>
            <td>{{ format()(d.value) }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class BarChart {
  readonly data = input.required<BarDatum[]>();
  /** Descripción para lectores de pantalla ("Ventas de los últimos 7 días"). */
  readonly ariaLabel = input.required<string>();
  /** Cómo se escribe un valor en el tooltip y en la tabla accesible. */
  readonly format = input<(n: number) => string>((n) => String(n));

  protected readonly width = signal(DEFAULT_WIDTH);
  protected readonly height = HEIGHT;
  protected readonly pad = PAD;

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      // Sin ResizeObserver (entornos de prueba) se queda con el ancho de partida.
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(([entry]) => {
        const measured = Math.round(entry.contentRect.width);
        if (measured > 0) this.width.set(Math.max(measured, MIN_WIDTH));
      });
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  private readonly top = computed(() => niceMax(Math.max(0, ...this.data().map((d) => d.value))));

  protected readonly guides = computed(() => {
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    return [0, 0.5, 1].map((f) => ({ y: PAD.top + plotH * (1 - f), base: f === 0 }));
  });

  protected readonly bars = computed(() => {
    const data = this.data();
    const plotW = this.width() - PAD.left - PAD.right;
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const slot = plotW / Math.max(data.length, 1);
    const w = Math.min(slot * 0.56, 44);
    // Con muchas barras (un mes) no caben todas las etiquetas: se muestra una de cada `step`,
    // contando desde la última para que "Hoy" siempre aparezca.
    const step = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(plotW / LABEL_SLOT))));
    return data.map((d, index) => {
      // Una barra con valor > 0 mide al menos 3px para que no desaparezca frente a una enorme.
      const h = d.value > 0 ? Math.max((d.value / this.top()) * plotH, 3) : 0;
      return {
        index,
        label: d.label,
        value: d.value,
        x: PAD.left + slot * index + (slot - w) / 2,
        y: PAD.top + plotH - h,
        w,
        h,
        last: index === data.length - 1,
        showLabel: (data.length - 1 - index) % step === 0,
      };
    });
  });
}
