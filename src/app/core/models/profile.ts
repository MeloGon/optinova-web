import { Role } from './role';

/** Fila de `perfiles` del usuario con sesión (= ProfileModel de Flutter). */
export interface Profile {
  id: string;
  name: string;
  /** Texto de `perfiles.sucursal` (OFTALVISION, MEDILENT...). */
  branch: string;
  role: Role;
  email: string;
}
