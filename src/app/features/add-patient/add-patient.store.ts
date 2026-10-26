import { Injectable, computed, inject, signal } from '@angular/core';
import { AppError } from '../../core/errors/app-error';
import { Patient } from '../../core/models/patient';
import { NewPatient, PatientRepository } from '../../core/repositories/patient.repository';
import { Result, ok } from '../../core/result';

/** Cuántos pacientes recientes se muestran debajo del formulario. */
export const LATEST_COUNT = 5;

/**
 * Estado de Agregar paciente (= AddPatient Notifier de Flutter).
 * Se provee en la página (providers: [AddPatientStore]): nace y muere con ella.
 */
@Injectable()
export class AddPatientStore {
  private readonly repo = inject(PatientRepository);

  private readonly latestState = signal<Patient[]>([]);
  readonly latest = this.latestState.asReadonly();

  private readonly savingState = signal(false);
  readonly saving = this.savingState.asReadonly();

  readonly hasLatest = computed(() => this.latestState().length > 0);

  /** Los últimos pacientes registrados. Si falla, la lista queda como estaba: es solo un apoyo. */
  async loadLatest(): Promise<void> {
    const result = await this.repo.search({ query: '', page: 1, pageSize: LATEST_COUNT });
    if (result.ok) this.latestState.set(result.value.items);
  }

  /** Pacientes con exactamente este nombre. Si la consulta falla, se sigue como si no hubiera ninguno. */
  async findDuplicates(name: string): Promise<Result<Patient[], AppError>> {
    const result = await this.repo.findByName(name);
    return result.ok ? result : ok([]);
  }

  /** Crea el paciente y, si salió bien, actualiza la lista de recientes. El error lo muestra quien llama. */
  async create(patient: NewPatient): Promise<Result<Patient, AppError>> {
    this.savingState.set(true);
    const result = await this.repo.create(patient);
    this.savingState.set(false);
    if (result.ok) await this.loadLatest();
    return result;
  }
}
