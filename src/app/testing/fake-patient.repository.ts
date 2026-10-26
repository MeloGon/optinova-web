import { AppError } from '../core/errors/app-error';
import { Page } from '../core/models/page';
import { Patient } from '../core/models/patient';
import { PatientRepository, PatientSearch } from '../core/repositories/patient.repository';
import { Result, err, ok } from '../core/result';

export const fakePatient = (id: number, name = `PACIENTE ${id}`): Patient => ({
  id,
  name,
  branch: 'OFTALVISION',
  phone: '555',
  gender: 'Femenino',
  observations: '',
  registeredOn: '2026-10-01',
  birthDate: null,
});

/** PatientRepository en memoria para tests (= un mock de mocktail). */
export class FakePatientRepository extends PatientRepository {
  patients: Patient[] = [];
  /** Si se asigna, la próxima búsqueda falla con este error. */
  failWith: AppError | null = null;
  /** Búsquedas recibidas, en orden. */
  calls: PatientSearch[] = [];
  /** Si se asigna, cada búsqueda espera a que se llame a la función devuelta (para probar carreras). */
  gate: (() => Promise<void>) | null = null;

  async search(params: PatientSearch): Promise<Result<Page<Patient>, AppError>> {
    this.calls.push(params);
    if (this.gate) await this.gate();
    if (this.failWith) return err(this.failWith);

    const words = params.query.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = this.patients.filter((p) => words.every((w) => p.name.toLowerCase().includes(w)));
    const from = (params.page - 1) * params.pageSize;
    return ok({ items: matches.slice(from, from + params.pageSize), total: matches.length });
  }
}
