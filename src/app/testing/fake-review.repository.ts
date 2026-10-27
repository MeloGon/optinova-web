import { AppError } from '../core/errors/app-error';
import { Review } from '../core/models/review';
import { NewReview, ReviewRepository } from '../core/repositories/review.repository';
import { Result, err, ok } from '../core/result';

export const fakeReview = (id: number | string, patientId: string, overrides: Partial<Review> = {}): Review => ({
  id: String(id),
  patientId,
  patientName: 'PACIENTE PRUEBA',
  branch: 'OFTALVISION',
  date: '2026-10-01',
  reasonConsult: '',
  clinicHistory: '',
  graduationType: '',
  optometricDiagnosis: '',
  odEsf: '',
  odCil: '',
  odEje: '',
  odAv: '',
  oiEsf: '',
  oiCil: '',
  oiEje: '',
  oiAv: '',
  addition: '',
  dip: '',
  odCbLc: '',
  odDiamLc: '',
  oiCbLc: '',
  oiDiamLc: '',
  avSinRxOdLejos: '',
  avSinRxOiLejos: '',
  cvOdLejos: '',
  cvOiLejos: '',
  avSinRxOdCerca: '',
  avSinRxOiCerca: '',
  avConRxOdCerca: '',
  avConRxOiCerca: '',
  observations: '',
  ...overrides,
});

/** ReviewRepository en memoria para tests (= un mock de mocktail). */
export class FakeReviewRepository extends ReviewRepository {
  reviews: Review[] = [];
  /** Búsquedas recibidas (ids de paciente), en orden. */
  calls: string[] = [];
  getFailWith: AppError | null = null;
  /** Medidas creadas con create, en orden. */
  created: NewReview[] = [];
  createFailWith: AppError | null = null;
  /** Medidas guardadas con update, en orden. */
  updated: Review[] = [];
  updateFailWith: AppError | null = null;
  /** Ids que se pidió eliminar, en orden. */
  deleted: string[] = [];
  deleteFailWith: AppError | null = null;
  private nextId = 1000;

  async getByPatient(patientId: string): Promise<Result<Review[], AppError>> {
    this.calls.push(patientId);
    if (this.getFailWith) return err(this.getFailWith);
    return ok(this.reviews.filter((r) => r.patientId === patientId));
  }

  async create(review: NewReview): Promise<Result<Review, AppError>> {
    if (this.createFailWith) return err(this.createFailWith);
    this.created.push(review);
    const saved: Review = { ...review, id: String(this.nextId++) };
    this.reviews = [saved, ...this.reviews];
    return ok(saved);
  }

  async update(review: Review): Promise<Result<void, AppError>> {
    if (this.updateFailWith) return err(this.updateFailWith);
    this.updated.push(review);
    this.reviews = this.reviews.map((r) => (r.id === review.id ? review : r));
    return ok(undefined);
  }

  async delete(id: string): Promise<Result<void, AppError>> {
    if (this.deleteFailWith) return err(this.deleteFailWith);
    this.deleted.push(id);
    this.reviews = this.reviews.filter((r) => r.id !== id);
    return ok(undefined);
  }
}
