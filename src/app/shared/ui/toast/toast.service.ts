// C-13 Toast
import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'danger' | 'warning' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  /** Qué pasó, en pasado y sin signos de exclamación: "Paciente eliminado". */
  title: string;
  /** El dato clave: "ANA LOPEZ ya no está en la lista". */
  text?: string;
}

const MAX_VISIBLE = 3;
/** Éxito e info se cierran solos; error y aviso esperan a que se cierren. */
const AUTO_DISMISS_MS = 5000;

/**
 * Mensajes breves no bloqueantes (= el CustomSnackbar de Flutter).
 * `ToastOutlet` (en el layout) los dibuja; cualquier servicio o página puede llamar a `show`.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly state = signal<Toast[]>([]);
  readonly toasts = this.state.asReadonly();
  private nextId = 1;

  show(toast: Omit<Toast, 'id'>): number {
    const id = this.nextId++;
    this.state.update((list) => [...list, { ...toast, id }].slice(-MAX_VISIBLE));
    if (toast.tone === 'success' || toast.tone === 'info') {
      setTimeout(() => this.dismiss(id), AUTO_DISMISS_MS);
    }
    return id;
  }

  dismiss(id: number): void {
    this.state.update((list) => list.filter((t) => t.id !== id));
  }
}
