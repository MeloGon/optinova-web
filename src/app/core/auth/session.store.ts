import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppError } from '../errors/app-error';
import { Profile } from '../models/profile';
import { Role, hasRole } from '../models/role';
import { AuthRepository } from '../repositories/auth.repository';
import { Result } from '../result';

/**
 * Sesión del usuario en toda la app (= authProvider de Flutter, con keepAlive).
 *
 * No hay estado "checking" (el splash de Flutter): la sesión se restaura en
 * provideAppInitializer, antes de que el router decida a dónde ir.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly repo = inject(AuthRepository);
  private readonly router = inject(Router);

  private readonly state = signal<Profile | null>(null);

  readonly profile = this.state.asReadonly();
  readonly isAuthenticated = computed(() => this.state() !== null);

  constructor() {
    // Si la sesión termina sola (token vencido, salir en otra pestaña), volver al login.
    this.repo.onSignedOut(() => {
      if (!this.state()) return;
      this.state.set(null);
      this.router.navigateByUrl('/auth/login');
    });
  }

  /** Se llama una vez al arrancar la app. */
  async restore(): Promise<void> {
    this.state.set(await this.repo.restoreSession());
  }

  async login(email: string, password: string): Promise<Result<Profile, AppError>> {
    const result = await this.repo.signIn(email, password);
    if (result.ok) this.state.set(result.value);
    return result;
  }

  async logout(): Promise<void> {
    this.state.set(null);
    await this.repo.signOut();
    await this.router.navigateByUrl('/auth/login');
  }

  /** ¿El usuario tiene al menos este rol? */
  can(min: Role): boolean {
    const profile = this.state();
    return profile !== null && hasRole(profile.role, min);
  }
}
