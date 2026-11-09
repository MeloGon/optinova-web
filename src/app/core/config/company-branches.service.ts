import { Injectable, Injector, inject } from '@angular/core';
import { BranchAdminRepository } from '../repositories/branch-admin.repository';
import { Branch, ConfigService } from './config.service';

/**
 * Carga las sucursales de la empresa del usuario en `ConfigService` (Fase 4b: nada de sucursales
 * escritas a mano). Se llama al restaurar la sesión y al iniciar sesión; `reload()` lo vuelve a
 * hacer tras crear, renombrar o cerrar una sucursal.
 *
 * Un megadmin puede leer las sucursales de todas las empresas, pero sus selectores muestran solo las
 * de la suya: mezclar empresas en un mismo selector sería confuso.
 *
 * Si no se pueden leer, la lista queda vacía en vez de mostrar las de otra empresa.
 * El repositorio se pide al momento de usarlo: sin él (tests de otras pantallas) se conserva la
 * lista inicial de `ConfigService`.
 */
@Injectable({ providedIn: 'root' })
export class CompanyBranchesService {
  private readonly injector = inject(Injector);
  private readonly config = inject(ConfigService);
  private companyId: string | null = null;

  async load(companyId: string): Promise<void> {
    this.companyId = companyId;
    await this.reload();
  }

  async reload(): Promise<void> {
    if (!this.companyId) return;
    const repo = this.injector.get(BranchAdminRepository, null);
    if (!repo) return;

    const result = await repo.list();
    const branches: Branch[] = result.ok
      ? result.value
          .filter((b) => b.companyId === this.companyId)
          .map((b) => ({ value: b.name, label: b.name, active: b.active }))
      : [];
    this.config.setBranches(branches);
  }
}
