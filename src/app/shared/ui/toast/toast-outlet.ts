// C-13 Toast
import { Component, inject } from '@angular/core';
import {
  LucideCircleCheck,
  LucideCircleX,
  LucideDynamicIcon,
  LucideIconInput,
  LucideInfo,
  LucideTriangleAlert,
  LucideX,
} from '@lucide/angular';
import { ToastService, ToastTone } from './toast.service';

const TONES: Record<ToastTone, { icon: LucideIconInput; badge: string }> = {
  success: { icon: LucideCircleCheck, badge: 'bg-success text-success-foreground' },
  danger: { icon: LucideCircleX, badge: 'bg-danger text-danger-foreground' },
  warning: { icon: LucideTriangleAlert, badge: 'bg-warning text-warning-foreground' },
  info: { icon: LucideInfo, badge: 'bg-info text-info-foreground' },
};

/** Dibuja los toasts arriba a la derecha, bajo el topbar. Va una sola vez, en el layout. */
@Component({
  selector: 'onv-toast-outlet',
  imports: [LucideDynamicIcon],
  template: `
    @for (toast of service.toasts(); track toast.id) {
      <div
        [attr.role]="toast.tone === 'danger' ? 'alert' : 'status'"
        class="pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-popover p-3 text-popover-foreground elev-lg"
      >
        <span class="grid size-6 shrink-0 place-items-center rounded-full {{ tones[toast.tone].badge }}">
          <svg [lucideIcon]="tones[toast.tone].icon" [size]="14"></svg>
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-[13px] leading-5 font-semibold">{{ toast.title }}</p>
          @if (toast.text) {
            <p class="text-body-sm text-muted-foreground">{{ toast.text }}</p>
          }
        </div>
        <button
          type="button"
          (click)="service.dismiss(toast.id)"
          aria-label="Cerrar aviso"
          class="grid size-6 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-muted"
        >
          <svg [lucideIcon]="closeIcon" [size]="14"></svg>
        </button>
      </div>
    }
  `,
  host: {
    class:
      'pointer-events-none fixed top-[calc(var(--onv-topbar-h)+12px)] right-4 z-(--z-toast) flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2',
    role: 'region',
    'aria-label': 'Notificaciones',
  },
})
export class ToastOutlet {
  protected readonly service = inject(ToastService);
  protected readonly tones = TONES;
  protected readonly closeIcon = LucideX;
}
