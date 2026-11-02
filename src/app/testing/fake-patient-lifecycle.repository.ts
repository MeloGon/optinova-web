import { appError, AppError } from '../core/errors/app-error';
import { Patient } from '../core/models/patient';
import {
  PatientLifecycleRepository,
  PatientLifecycleResult,
  PatientLifecycleStatus,
  SupervisorCredentials,
} from '../core/repositories/patient-lifecycle.repository';
import { Result, err, ok } from '../core/result';

/** Credenciales de supervisor que el fake acepta como correctas (= el supervisor del seed). */
export const FAKE_SUPERVISOR: SupervisorCredentials = {
  email: 'supervisor@optinova.test',
  password: 'correcta',
};

/**
 * PatientLifecycleRepository en memoria para tests de la página. No repite la lógica de roles
 * del servidor (eso ya lo prueba el Edge Function a mano): solo valida las credenciales de
 * supervisor cuando la página las manda, igual que haría una respuesta real del servidor.
 */
export class FakePatientLifecycleRepository extends PatientLifecycleRepository {
  /**
   * El `FakePatientRepository` que ve la misma pantalla: borrar/archivar/restaurar también lo
   * actualiza ahí, igual que en la DB real son la misma tabla. Opcional, para tests que no miran
   * la lista después.
   */
  constructor(private readonly patientRepo?: { patients: Patient[] }) {
    super();
  }

  /** Nivel que "tiene" cada paciente; sin entrada = `none`. */
  statuses: Record<string, PatientLifecycleStatus> = {};
  resolveFailWith: AppError | null = null;
  applyFailWith: AppError | null = null;

  resolved: string[] = [];
  applied: { patientId: string; supervisor?: SupervisorCredentials }[] = [];
  restored: string[] = [];
  deleted: string[] = [];
  archived: string[] = [];

  async resolve(patientId: string): Promise<Result<PatientLifecycleStatus, AppError>> {
    this.resolved.push(patientId);
    if (this.resolveFailWith) return err(this.resolveFailWith);
    return ok(this.statuses[patientId] ?? { tier: 'none', reviewCount: 0, saleCount: 0 });
  }

  async apply(
    patientId: string,
    supervisor?: SupervisorCredentials,
  ): Promise<Result<PatientLifecycleResult, AppError>> {
    this.applied.push({ patientId, supervisor });
    if (this.applyFailWith) return err(this.applyFailWith);

    const status = this.statuses[patientId] ?? { tier: 'none', reviewCount: 0, saleCount: 0 };
    if (
      status.tier === 'reviews' &&
      supervisor &&
      (supervisor.email !== FAKE_SUPERVISOR.email || supervisor.password !== FAKE_SUPERVISOR.password)
    ) {
      return err(appError('unauthorized', 'Correo o contraseña incorrectos.'));
    }

    if (status.tier === 'sales') {
      this.archived.push(patientId);
      this.setArchivedOn(patientId, '2026-11-02');
      return ok({ result: 'archived' });
    }
    this.deleted.push(patientId);
    if (this.patientRepo) {
      this.patientRepo.patients = this.patientRepo.patients.filter((p) => p.id !== patientId);
    }
    return ok({ result: 'deleted' });
  }

  async restore(patientId: string): Promise<Result<void, AppError>> {
    this.restored.push(patientId);
    if (this.applyFailWith) return err(this.applyFailWith);
    this.setArchivedOn(patientId, null);
    return ok(undefined);
  }

  private setArchivedOn(patientId: string, archivedOn: string | null): void {
    if (!this.patientRepo) return;
    this.patientRepo.patients = this.patientRepo.patients.map((p) =>
      p.id === patientId ? { ...p, archivedOn } : p,
    );
  }
}
