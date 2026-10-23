import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from '../models/role';
import { SessionStore } from './session.store';

// Guards = el `redirect` de go_router. Devuelven true (pasa) o la ruta a donde redirigir.

/** Solo con sesión. Sin sesión → login. */
export const authGuard: CanActivateFn = () => {
  const session = inject(SessionStore);
  return session.isAuthenticated() || inject(Router).parseUrl('/auth/login');
};

/** Solo sin sesión (login). Con sesión → dashboard. */
export const guestGuard: CanActivateFn = () => {
  const session = inject(SessionStore);
  return !session.isAuthenticated() || inject(Router).parseUrl('/dashboard');
};

/** Solo con este rol o mayor. Si no → dashboard. */
export const roleGuard =
  (min: Role): CanActivateFn =>
  () =>
    inject(SessionStore).can(min) || inject(Router).parseUrl('/dashboard');
