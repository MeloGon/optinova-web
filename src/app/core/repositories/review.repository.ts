import { AppError } from '../errors/app-error';
import { Review } from '../models/review';
import { Result } from '../result';

/** Lo que se escribe al crear una medida: el ID y created_at los pone la DB. */
export type NewReview = Omit<Review, 'id'>;

/** Contrato de medidas/revisiones (= ReviewRepository abstracto de Flutter). */
export abstract class ReviewRepository {
  /** Medidas de un paciente, de la más reciente a la más antigua. */
  abstract getByPatient(patientId: string): Promise<Result<Review[], AppError>>;

  abstract create(review: NewReview): Promise<Result<Review, AppError>>;

  /** Guarda los datos editables de la medida (todo salvo paciente y fecha). */
  abstract update(review: Review): Promise<Result<void, AppError>>;

  abstract delete(id: string): Promise<Result<void, AppError>>;
}
