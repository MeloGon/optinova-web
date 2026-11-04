// C-07 Table
import { Component, Directive, input } from '@angular/core';

/**
 * Estilo de una `<table>` densa: cabecera fija, filas con borde y hover, alto y texto según
 * la densidad (variables --onv-row-h, --onv-cell-x, --onv-cell-fs del tema).
 *
 * `min-w-full` (no `w-full`) + `whitespace-nowrap`: con viewport angosto (celular), la tabla
 * mantiene su ancho natural y hace scroll horizontal dentro de `onv-table-card` en vez de
 * encoger columnas y partir el texto en varias líneas (quedaba feo en mobile en Historial,
 * Egresos y Buscar paciente; es el mismo componente en las tres).
 *
 *   <table onvTable>...</table>
 */
@Directive({
  selector: 'table[onvTable]',
  host: {
    class:
      'min-w-full border-collapse whitespace-nowrap text-[length:var(--onv-cell-fs)] ' +
      '[&_th]:sticky [&_th]:top-0 [&_th]:z-(--z-sticky) [&_th]:h-9 [&_th]:bg-muted [&_th]:px-(--onv-cell-x) ' +
      // :not(.text-right):not(.text-center) — si no, esta regla le gana en especificidad a esas
      // clases puestas en el propio <th> (ambas son una clase + un elemento), y un encabezado
      // numérico con `class="text-right"` se queda alineado a la izquierda igual.
      '[&_th:not(.text-right):not(.text-center)]:text-left [&_th]:text-caption [&_th]:text-muted-foreground in-data-[density=compact]:[&_th]:h-8 ' +
      '[&_td]:h-(--onv-row-h) [&_td]:px-(--onv-cell-x) [&_tbody_tr]:border-t [&_tbody_tr]:border-border ' +
      '[&_tbody_tr:hover]:bg-subtle',
  },
})
export class OnvTable {}

/**
 * Tarjeta que contiene la tabla (con scroll propio) y, debajo, su paginador:
 *
 *   <onv-table-card [busy]="loading()">
 *     <table onvTable>...</table>
 *     <onv-paginator footer ... />
 *   </onv-table-card>
 */
@Component({
  selector: 'onv-table-card',
  template: `
    <div class="overflow-auto" [class.opacity-60]="busy()" [attr.aria-busy]="busy()">
      <ng-content />
    </div>
    <ng-content select="[footer]" />
  `,
  host: { class: 'block overflow-hidden rounded-lg border border-border bg-card elev-sm' },
})
export class TableCard {
  /** Cargando datos nuevos: la tabla se atenúa pero conserva lo que ya mostraba. */
  readonly busy = input(false);
}
