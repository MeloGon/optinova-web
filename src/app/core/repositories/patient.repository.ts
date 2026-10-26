import { AppError } from '../errors/app-error';
import { Page } from '../models/page';
import { Patient } from '../models/patient';
import { Result } from '../result';

export interface PatientSearch {
  /** Texto a buscar en el nombre; vacío = todos. */
  query: string;
  /** Empieza en 1. */
  page: number;
  pageSize: number;
}

/** Lo que se escribe al crear un paciente: el ID, la fecha de registro y created_at los pone la DB. */
export type NewPatient = Omit<Patient, 'id' | 'registeredOn'>;

/** Contrato de pacientes (= PatientRepository abstracto de Flutter). */
export abstract class PatientRepository {
  /** Pacientes por nombre, del registro más reciente al más antiguo. */
  abstract search(params: PatientSearch): Promise<Result<Page<Patient>, AppError>>;

  /** Crea el paciente y lo devuelve con el ID y la fecha de registro que le dio la DB. */
  abstract create(patient: NewPatient): Promise<Result<Patient, AppError>>;

  /**
   * Pacientes cuyo nombre es exactamente este (sin distinguir mayúsculas), hasta 5.
   * Las revisiones y ventas se enlazan por nombre: dos pacientes iguales mezclarían su historial.
   */
  abstract findByName(name: string): Promise<Result<Patient[], AppError>>;

  /** Guarda los datos editables del paciente (nombre, teléfono, género, nacimiento, sucursal, observaciones). */
  abstract update(patient: Patient): Promise<Result<void, AppError>>;

  /** Elimina al paciente. Las revisiones y ventas enlazadas por nombre no se tocan (igual que en Flutter). */
  abstract delete(id: string): Promise<Result<void, AppError>>;
}
