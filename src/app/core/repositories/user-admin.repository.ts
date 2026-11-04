import { AppError } from '../errors/app-error';
import { ManagedUser } from '../models/managed-user';
import { Role } from '../models/role';
import { Result } from '../result';

export interface NewManagedUser {
  name: string;
  branch: string | null;
  role: Role;
  email: string;
  password: string;
}

export interface ManagedUserEdit {
  name: string;
  branch: string | null;
  role: Role;
}

/**
 * Contrato de administración de usuarios (= `userAdminRepositoryProvider` de Flutter, ampliado:
 * Flutter solo tenía listar y resetear contraseña; acá se agregan crear, editar y
 * activar/desactivar, pedido del dueño). Todo pasa por el Edge Function `megadmin-users`
 * (service role, nunca expuesto al cliente); "eliminar" no existe a propósito, se desactiva
 * (ban de Supabase Auth, reversible) porque el usuario puede tener ventas o auditoría
 * encadenadas a su id.
 */
export abstract class UserAdminRepository {
  abstract list(): Promise<Result<ManagedUser[], AppError>>;

  abstract create(draft: NewManagedUser): Promise<Result<ManagedUser, AppError>>;

  abstract update(userId: string, draft: ManagedUserEdit): Promise<Result<void, AppError>>;

  abstract setActive(userId: string, active: boolean): Promise<Result<void, AppError>>;

  abstract resetPassword(userId: string, newPassword: string): Promise<Result<void, AppError>>;
}
