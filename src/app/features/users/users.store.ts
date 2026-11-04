import { Injectable, computed, inject, signal } from '@angular/core';
import { AppError } from '../../core/errors/app-error';
import { ManagedUser } from '../../core/models/managed-user';
import { ManagedUserEdit, NewManagedUser, UserAdminRepository } from '../../core/repositories/user-admin.repository';
import { Result } from '../../core/result';

interface UsersState {
  users: ManagedUser[];
  loading: boolean;
  /** Mensaje para el usuario; null si no hay error. */
  error: string | null;
  /** Falso hasta que llega la primera respuesta: distingue "cargando" de "sin usuarios". */
  loaded: boolean;
}

/**
 * Estado de Settings · Usuarios (= UsersManagement Notifier de Flutter, ampliado con
 * crear/editar/activar-desactivar; sin paginar, la lista de una óptica es chica).
 * Se provee en la página (providers: [UsersStore]).
 */
@Injectable()
export class UsersStore {
  private readonly repo = inject(UserAdminRepository);

  private readonly state = signal<UsersState>({
    users: [],
    loading: false,
    error: null,
    loaded: false,
  });

  readonly users = computed(() => this.state().users);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly loaded = computed(() => this.state().loaded);

  async load(): Promise<void> {
    this.state.update((s) => ({ ...s, loading: true, error: null }));
    const result = await this.repo.list();
    if (result.ok) {
      this.state.update((s) => ({ ...s, users: result.value, loading: false, loaded: true }));
    } else {
      this.state.update((s) => ({ ...s, loading: false, error: result.error.message, loaded: true }));
    }
  }

  async create(draft: NewManagedUser): Promise<Result<ManagedUser, AppError>> {
    const result = await this.repo.create(draft);
    if (result.ok) await this.load();
    return result;
  }

  async update(userId: string, draft: ManagedUserEdit): Promise<Result<void, AppError>> {
    const result = await this.repo.update(userId, draft);
    if (result.ok) await this.load();
    return result;
  }

  async setActive(userId: string, active: boolean): Promise<Result<void, AppError>> {
    const result = await this.repo.setActive(userId, active);
    if (result.ok) await this.load();
    return result;
  }

  async resetPassword(userId: string, newPassword: string): Promise<Result<void, AppError>> {
    return this.repo.resetPassword(userId, newPassword);
  }
}
