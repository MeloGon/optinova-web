/** Roles de `perfiles.rol`, de menor a mayor permiso. */
export const ROLES = ['vendedor', 'supervisor', 'admin', 'megadmin'] as const;
export type Role = (typeof ROLES)[number];

/** ¿`role` tiene al menos los permisos de `min`? (`admin` cumple `supervisor`). */
export const hasRole = (role: Role, min: Role): boolean => ROLES.indexOf(role) >= ROLES.indexOf(min);
