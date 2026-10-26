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

/** Contrato de pacientes (= PatientRepository abstracto de Flutter). */
export abstract class PatientRepository {
  /** Pacientes por nombre, del registro más reciente al más antiguo. */
  abstract search(params: PatientSearch): Promise<Result<Page<Patient>, AppError>>;

  /** Guarda los datos editables del paciente (nombre, teléfono, género, nacimiento, sucursal, observaciones). */
  abstract update(patient: Patient): Promise<Result<void, AppError>>;

  /** Elimina al paciente. Las revisiones y ventas enlazadas por nombre no se tocan (igual que en Flutter). */
  abstract delete(id: string): Promise<Result<void, AppError>>;
}
