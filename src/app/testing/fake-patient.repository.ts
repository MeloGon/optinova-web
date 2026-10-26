import { AppError } from '../core/errors/app-error';
import { Page } from '../core/models/page';
import { Patient } from '../core/models/patient';
import { NewPatient, PatientRepository, PatientSearch } from '../core/repositories/patient.repository';
import { Result, err, ok } from '../core/result';

export const fakePatient = (id: number | string, name = `PACIENTE ${id}`): Patient => ({
  id: String(id),
  name,
  branch: 'OFTALVISION',
  phone: '555',
  secondaryPhone: '',
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
  /** Pacientes guardados con update, en orden. */
  updated: Patient[] = [];
  /** Si se asigna, el próximo update falla con este error. */
  updateFailWith: AppError | null = null;
  /** Ids que se pidió eliminar, en orden. */
  deleted: string[] = [];
  /** Si se asigna, el próximo delete falla con este error. */
  deleteFailWith: AppError | null = null;
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

  /** Pacientes creados con create, en orden. */
  created: NewPatient[] = [];
  /** Si se asigna, el próximo create falla con este error. */
  createFailWith: AppError | null = null;
  private nextId = 1000;

  async create(patient: NewPatient): Promise<Result<Patient, AppError>> {
    if (this.createFailWith) return err(this.createFailWith);
    this.created.push(patient);
    // Como la DB: ID nuevo y fecha de registro de hoy; el más reciente va primero en la lista.
    const saved: Patient = { ...patient, id: String(this.nextId++), registeredOn: '2026-10-26' };
    this.patients = [saved, ...this.patients];
    return ok(saved);
  }

  async findByName(name: string): Promise<Result<Patient[], AppError>> {
    const wanted = name.trim().toLowerCase();
    return ok(this.patients.filter((p) => p.name.toLowerCase() === wanted).slice(0, 5));
  }

  async update(patient: Patient): Promise<Result<void, AppError>> {
    if (this.updateFailWith) return err(this.updateFailWith);
    this.updated.push(patient);
    this.patients = this.patients.map((p) => (p.id === patient.id ? patient : p));
    return ok(undefined);
  }

  async delete(id: string): Promise<Result<void, AppError>> {
    if (this.deleteFailWith) return err(this.deleteFailWith);
    this.deleted.push(id);
    this.patients = this.patients.filter((p) => p.id !== id);
    return ok(undefined);
  }
}
