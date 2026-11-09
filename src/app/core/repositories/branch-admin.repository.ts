import { AppError } from '../errors/app-error';
import { ManagedBranch } from '../models/managed-branch';
import { Result } from '../result';

export interface BranchEdit {
  /** Nombre nuevo; omitido = no cambia. Renombrar actualiza todo el historial de la sucursal. */
  name?: string;
  /** `false` = cerrar, `true` = reabrir; omitido = no cambia. */
  active?: boolean;
}

export interface NewCompany {
  name: string;
  /** Primera sucursal: toda empresa nace con una. */
  branch: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

/**
 * Contrato de administración de sucursales y empresas (sin equivalente en Flutter: allá las
 * sucursales eran un enum fijo). Las sucursales se leen directo (RLS: un admin ve las de su
 * empresa, un megadmin las de todas); escribir pasa por funciones de Postgres (`crear_sucursal`,
 * `editar_sucursal`) que validan el rol. Crear una empresa pasa por el Edge Function
 * `megadmin-users`, que también crea a su primer admin. Nada se borra: cerrar una sucursal la
 * deja en `activa = false`.
 */
export abstract class BranchAdminRepository {
  abstract list(): Promise<Result<ManagedBranch[], AppError>>;

  /** `companyId` solo lo usa un megadmin; un admin siempre crea en su propia empresa. */
  abstract create(name: string, companyId?: string): Promise<Result<void, AppError>>;

  abstract update(id: number, edit: BranchEdit): Promise<Result<void, AppError>>;

  abstract createCompany(draft: NewCompany): Promise<Result<void, AppError>>;
}
