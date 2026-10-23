import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SessionStore } from '../../core/auth/session.store';

interface LoginState {
  loading: boolean;
  /** Mensaje para el usuario; null si no hay error. */
  error: string | null;
}

/**
 * Estado de la pantalla de login (= Login Notifier de Flutter).
 * Se provee en la página (providers: [LoginStore]): se crea y destruye con ella (= autoDispose).
 */
@Injectable()
export class LoginStore {
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  private readonly state = signal<LoginState>({ loading: false, error: null });
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);

  async submit(email: string, password: string): Promise<void> {
    this.state.set({ loading: true, error: null });
    const result = await this.session.login(email.trim(), password);
    if (result.ok) {
      await this.router.navigateByUrl('/dashboard');
      return;
    }
    this.state.set({ loading: false, error: result.error.message });
  }

  clearError(): void {
    this.state.update((s) => ({ ...s, error: null }));
  }
}
