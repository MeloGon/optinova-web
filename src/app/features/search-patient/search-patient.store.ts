import { Injectable, computed, inject, signal } from '@angular/core';
import { AppError } from '../../core/errors/app-error';
import { Patient } from '../../core/models/patient';
import { Review } from '../../core/models/review';
import { PatientRepository, PatientSearch } from '../../core/repositories/patient.repository';
import { NewReview, ReviewRepository } from '../../core/repositories/review.repository';
import { Result } from '../../core/result';

interface SearchState {
  items: Patient[];
  total: number;
  loading: boolean;
  /** Mensaje para el usuario; null si no hay error. */
  error: string | null;
  /** Falso hasta que llega la primera respuesta: distingue "cargando" de "sin pacientes". */
  loaded: boolean;
}

/**
 * Estado de Buscar paciente (= SearchPatient Notifier de Flutter).
 * Se provee en la página (providers: [SearchPatientStore]): nace y muere con ella (= autoDispose).
 *
 * La URL es la fuente de verdad (?q=&page=&size=): la página llama a `load` cada vez que cambia.
 */
@Injectable()
export class SearchPatientStore {
  private readonly repo = inject(PatientRepository);
  private readonly reviewRepo = inject(ReviewRepository);

  private readonly state = signal<SearchState>({
    items: [],
    total: 0,
    loading: false,
    error: null,
    loaded: false,
  });

  readonly items = computed(() => this.state().items);
  readonly total = computed(() => this.state().total);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);
  readonly loaded = computed(() => this.state().loaded);

  /** Número de la última búsqueda lanzada: una respuesta vieja no pisa a una más nueva. */
  private lastRequest = 0;

  /** Última búsqueda pedida: se repite después de eliminar para que la lista quede al día. */
  private lastSearch: PatientSearch | null = null;

  async load(search: PatientSearch): Promise<void> {
    this.lastSearch = search;
    const request = ++this.lastRequest;
    // Se conservan los resultados anteriores mientras carga (el diseño pide atenuarlos, no vaciarlos).
    this.state.update((s) => ({ ...s, loading: true, error: null }));

    const result = await this.repo.search(search);
    if (request !== this.lastRequest) return;

    if (result.ok) {
      this.state.set({
        items: result.value.items,
        total: result.value.total,
        loading: false,
        error: null,
        loaded: true,
      });
    } else {
      this.state.update((s) => ({ ...s, loading: false, error: result.error.message, loaded: true }));
    }
  }

  /** Guarda los cambios del paciente y, si salió bien, vuelve a pedir la lista. El error lo muestra quien llama. */
  async update(patient: Patient): Promise<Result<void, AppError>> {
    return this.refreshAfter(await this.repo.update(patient));
  }

  /** Elimina al paciente y, si salió bien, vuelve a pedir la lista. El error lo muestra quien llama. */
  async remove(patient: Patient): Promise<Result<void, AppError>> {
    return this.refreshAfter(await this.repo.delete(patient.id));
  }

  private async refreshAfter(result: Result<void, AppError>): Promise<Result<void, AppError>> {
    if (result.ok && this.lastSearch) await this.load(this.lastSearch);
    return result;
  }

  /** Medidas de un paciente, de la más reciente a la más antigua (= getReviewsByPatient de Flutter). */
  async loadReviews(patientId: string): Promise<Result<Review[], AppError>> {
    return this.reviewRepo.getByPatient(patientId);
  }

  async createReview(review: NewReview): Promise<Result<Review, AppError>> {
    return this.reviewRepo.create(review);
  }

  async updateReview(review: Review): Promise<Result<void, AppError>> {
    return this.reviewRepo.update(review);
  }

  async deleteReview(id: string): Promise<Result<void, AppError>> {
    return this.reviewRepo.delete(id);
  }
}
