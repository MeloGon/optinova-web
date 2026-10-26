// C-17 Skeleton
import { Component } from '@angular/core';

/**
 * Bloque gris con brillo que ocupa el lugar de un contenido que todavía carga.
 * El tamaño lo da quien lo usa, igual a la geometría real: `<onv-skeleton class="h-3 w-40" />`.
 */
@Component({
  selector: 'onv-skeleton',
  template: '',
  styles: `
    :host {
      display: block;
      border-radius: var(--radius-sm);
      background-color: var(--color-muted);
      background-image: linear-gradient(90deg, transparent, var(--color-border), transparent);
      background-size: 200% 100%;
      animation: onv-shimmer var(--duration-skeleton) linear infinite;
    }
    @keyframes onv-shimmer {
      from {
        background-position: 200% 0;
      }
      to {
        background-position: -200% 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host {
        animation: none;
        background-image: none;
      }
    }
  `,
  host: { 'aria-hidden': 'true' },
})
export class Skeleton {}
