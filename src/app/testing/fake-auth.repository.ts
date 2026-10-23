import { AppError, appError } from '../core/errors/app-error';
import { Profile } from '../core/models/profile';
import { Role } from '../core/models/role';
import { AuthRepository } from '../core/repositories/auth.repository';
import { Result, err, ok } from '../core/result';

export const fakeProfile = (role: Role): Profile => ({
  id: `id-${role}`,
  name: `${role} Prueba`,
  branch: 'OFTALVISION',
  role,
  email: `${role}@optinova.test`,
});

/** AuthRepository en memoria para tests (= un mock de mocktail). */
export class FakeAuthRepository extends AuthRepository {
  /** Perfil con sesión guardada, o null. */
  session: Profile | null = null;
  /** Contraseña válida para signIn. */
  password = 'secreto123';

  async signIn(email: string, password: string): Promise<Result<Profile, AppError>> {
    if (password !== this.password) {
      return err(appError('unauthorized', 'Correo o contraseña incorrectos.'));
    }
    this.session = { ...fakeProfile('vendedor'), email };
    return ok(this.session);
  }

  async restoreSession(): Promise<Profile | null> {
    return this.session;
  }

  async signOut(): Promise<void> {
    this.session = null;
  }

  onSignedOut(): void {}
}
