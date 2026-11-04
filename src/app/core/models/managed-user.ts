import { Role } from './role';

/** Un usuario tal como lo administra un megadmin (= ProfileModel + email/último acceso de Flutter). */
export interface ManagedUser {
  id: string;
  name: string;
  branch: string | null;
  role: Role;
  email: string;
  /** `null` si nunca inició sesión. */
  lastSignInAt: string | null;
  /** `false` = desactivado (ban de Supabase Auth, reversible; nunca se borra el usuario). */
  active: boolean;
}
