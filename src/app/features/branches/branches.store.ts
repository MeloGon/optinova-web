import { Injectable, computed, inject, signal } from '@angular/core';
import { AppError } from '../../core/errors/app-error';
import { ManagedBranch } from '../../core/models/managed-branch';
import { BranchAdminRepository, BranchEdit, NewCompany } from '../../core/repositories/branch-admin.repository';
import { Result } from '../../core/result';

interface BranchesState {
  branches: ManagedBranch[];
  loading: boolean;
  /** Mensaje para el usuario; null si no hay error. */
  error: string | null;
  /** Falso hasta que llega la primera respuesta: distingue "cargando" de "sin sucursales". */
  loaded: boolean;
}

/** Sucursales abiertas y cerradas de una misma empresa, para mostrarlas agrupadas. */
export interface CompanyGroup {
  companyId: string;
  companyName: string;
  branches: ManagedBranch[];
}

/**
 * Estado de Settings · Sucursales (= Notifier de Riverpod). Se provee en la página.
 * Tras cada cambio vuelve a pedir la lista: el servidor es la fuente de verdad (por ejemplo,
 * guarda el nombre en mayúsculas).
 */
@Injectable()
export class BranchesStore {
  private readonly repo = inject(BranchAdminRepository);

  private readonly state = signal<BranchesState>({
    branches: [],
    loading: false,
    error: null,
    loaded: false,
  });

  readonly branches = computed(() => this.state().branches);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly loaded = computed(() => this.state().loaded);

  /** Agrupadas por empresa. Un admin ve un solo grupo; un megadmin, uno por empresa. */
  readonly groups = computed<CompanyGroup[]>(() => {
    const byCompany = new Map<string, CompanyGroup>();
    for (const branch of this.state().branches) {
      const group = byCompany.get(branch.companyId) ?? {
        companyId: branch.companyId,
        companyName: branch.companyName,
        branches: [],
      };
      group.branches.push(branch);
      byCompany.set(branch.companyId, group);
    }
    return [...byCompany.values()].sort((a, b) => a.companyName.localeCompare(b.companyName));
  });

  /** ¿Cerrar esta sucursal dejaría a su empresa sin ninguna abierta? (el servidor también lo rechaza). */
  isLastOpen(branch: ManagedBranch): boolean {
    return (
      branch.active &&
      !this.state().branches.some((b) => b.companyId === branch.companyId && b.active && b.id !== branch.id)
    );
  }

  async load(): Promise<void> {
    this.state.update((s) => ({ ...s, loading: true, error: null }));
    const result = await this.repo.list();
    if (result.ok) {
      this.state.update((s) => ({ ...s, branches: result.value, loading: false, loaded: true }));
    } else {
      this.state.update((s) => ({ ...s, loading: false, error: result.error.message, loaded: true }));
    }
  }

  async create(name: string, companyId?: string): Promise<Result<void, AppError>> {
    const result = await this.repo.create(name, companyId);
    if (result.ok) await this.load();
    return result;
  }

  async update(id: number, edit: BranchEdit): Promise<Result<void, AppError>> {
    const result = await this.repo.update(id, edit);
    if (result.ok) await this.load();
    return result;
  }

  async createCompany(draft: NewCompany): Promise<Result<void, AppError>> {
    const result = await this.repo.createCompany(draft);
    if (result.ok) await this.load();
    return result;
  }
}
