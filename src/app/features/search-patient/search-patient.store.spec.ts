import { TestBed } from '@angular/core/testing';
import { appError } from '../../core/errors/app-error';
import { PatientLifecycleRepository } from '../../core/repositories/patient-lifecycle.repository';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { ReviewRepository } from '../../core/repositories/review.repository';
import { FakePatientLifecycleRepository } from '../../testing/fake-patient-lifecycle.repository';
import { FakePatientRepository, fakePatient } from '../../testing/fake-patient.repository';
import { FakeReviewRepository, fakeReview } from '../../testing/fake-review.repository';
import { SearchPatientStore } from './search-patient.store';

describe('SearchPatientStore', () => {
  let repo: FakePatientRepository;
  let reviewRepo: FakeReviewRepository;
  let lifecycleRepo: FakePatientLifecycleRepository;
  let store: SearchPatientStore;

  beforeEach(() => {
    repo = new FakePatientRepository();
    repo.patients = [
      fakePatient(1, 'MARIA LOPEZ'),
      fakePatient(2, 'JUAN GARCIA'),
      fakePatient(3, 'ANA GARCIA'),
    ];
    reviewRepo = new FakeReviewRepository();
    lifecycleRepo = new FakePatientLifecycleRepository(repo);
    TestBed.configureTestingModule({
      providers: [
        SearchPatientStore,
        { provide: PatientRepository, useValue: repo },
        { provide: ReviewRepository, useValue: reviewRepo },
        { provide: PatientLifecycleRepository, useValue: lifecycleRepo },
      ],
    });
    store = TestBed.inject(SearchPatientStore);
  });

  it('empieza sin cargar y sin resultados', () => {
    expect(store.loaded()).toBe(false);
    expect(store.items()).toEqual([]);
    expect(store.total()).toBe(0);
  });

  it('carga la página pedida y el total', async () => {
    await store.load({ query: '', page: 1, pageSize: 2 });
    expect(store.items().map((p) => p.id)).toEqual(['1', '2']);
    expect(store.total()).toBe(3);
    expect(store.loaded()).toBe(true);
    expect(store.loading()).toBe(false);
  });

  it('filtra por nombre con varias palabras en cualquier orden', async () => {
    await store.load({ query: 'garcia ana', page: 1, pageSize: 10 });
    expect(store.items().map((p) => p.id)).toEqual(['3']);
    expect(store.total()).toBe(1);
  });

  it('un error se guarda como mensaje y conserva los resultados anteriores', async () => {
    await store.load({ query: '', page: 1, pageSize: 10 });
    repo.failWith = appError('network', 'Sin conexión.');
    await store.load({ query: 'x', page: 1, pageSize: 10 });
    expect(store.error()).toBe('Sin conexión.');
    expect(store.items().length).toBe(3);
    expect(store.loading()).toBe(false);
  });

  it('una búsqueda nueva borra el error anterior', async () => {
    repo.failWith = appError('server', 'Falló.');
    await store.load({ query: '', page: 1, pageSize: 10 });
    repo.failWith = null;
    await store.load({ query: '', page: 1, pageSize: 10 });
    expect(store.error()).toBeNull();
  });

  it('mientras carga conserva los resultados y marca loading', async () => {
    await store.load({ query: '', page: 1, pageSize: 10 });
    let release!: () => void;
    repo.gate = () => new Promise<void>((resolve) => (release = resolve));

    const pending = store.load({ query: 'ana', page: 1, pageSize: 10 });
    expect(store.loading()).toBe(true);
    expect(store.items().length).toBe(3);

    release();
    await pending;
    expect(store.loading()).toBe(false);
    expect(store.items().length).toBe(1);
  });

  it('resolveLifecycle pide el nivel al repositorio de ciclo de vida', async () => {
    lifecycleRepo.statuses['2'] = { tier: 'reviews', reviewCount: 3, saleCount: 0 };

    const result = await store.resolveLifecycle('2');

    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toEqual({ tier: 'reviews', reviewCount: 3, saleCount: 0 });
    expect(lifecycleRepo.resolved).toEqual(['2']);
  });

  it('al aplicar el ciclo de vida, borra/archiva y vuelve a pedir la misma búsqueda', async () => {
    await store.load({ query: 'garcia', page: 1, pageSize: 10 });
    expect(store.total()).toBe(2);

    const result = await store.applyLifecycle(store.items()[0].id);

    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toEqual({ result: 'deleted' });
    expect(lifecycleRepo.deleted).toEqual(['2']);
    expect(repo.calls.at(-1)).toEqual({ query: 'garcia', page: 1, pageSize: 10 });
    expect(store.items().map((p) => p.id)).toEqual(['3']);
    expect(store.total()).toBe(1);
  });

  it('applyLifecycle manda las credenciales de supervisor al repositorio', async () => {
    await store.applyLifecycle('2', { email: 'a@b.com', password: 'x' });

    expect(lifecycleRepo.applied).toEqual([{ patientId: '2', supervisor: { email: 'a@b.com', password: 'x' } }]);
  });

  it('restore limpia el archivado y vuelve a pedir la misma búsqueda', async () => {
    await store.load({ query: '', page: 1, pageSize: 10 });
    const callsBefore = repo.calls.length;

    const result = await store.restore('2');

    expect(result.ok).toBe(true);
    expect(lifecycleRepo.restored).toEqual(['2']);
    expect(repo.calls.length).toBe(callsBefore + 1);
  });

  it('al editar guarda en el repositorio y refresca la lista', async () => {
    await store.load({ query: '', page: 1, pageSize: 10 });

    const result = await store.update({ ...store.items()[0], name: 'MARIA CAMBIADA' });

    expect(result.ok).toBe(true);
    expect(repo.updated.map((p) => p.name)).toEqual(['MARIA CAMBIADA']);
    expect(store.items()[0].name).toBe('MARIA CAMBIADA');
  });

  it('si editar falla devuelve el error y no refresca', async () => {
    await store.load({ query: '', page: 1, pageSize: 10 });
    const callsBefore = repo.calls.length;
    repo.updateFailWith = appError('server', 'Falló.');

    const result = await store.update({ ...store.items()[0], name: 'X' });

    expect(result.ok).toBe(false);
    expect(repo.calls.length).toBe(callsBefore);
  });

  it('si aplicar falla devuelve el error y no cambia la lista', async () => {
    await store.load({ query: '', page: 1, pageSize: 10 });
    const callsBefore = repo.calls.length;
    lifecycleRepo.applyFailWith = appError('unauthorized', 'Sin permiso.');

    const result = await store.applyLifecycle(store.items()[0].id);

    expect(result.ok).toBe(false);
    expect(repo.calls.length).toBe(callsBefore);
    expect(store.items().length).toBe(3);
    expect(store.error()).toBeNull();
  });

  it('una respuesta vieja no pisa a una más nueva', async () => {
    const releases: (() => void)[] = [];
    repo.gate = () => new Promise<void>((resolve) => releases.push(resolve));

    const first = store.load({ query: 'maria', page: 1, pageSize: 10 });
    const second = store.load({ query: 'ana', page: 1, pageSize: 10 });

    // La segunda responde primero; la primera llega tarde.
    releases[1]();
    await second;
    releases[0]();
    await first;

    expect(store.items().map((p) => p.id)).toEqual(['3']);
  });

  it('pide las medidas de un paciente al repositorio de medidas', async () => {
    reviewRepo.reviews = [fakeReview(1, '2'), fakeReview(2, '3')];

    const result = await store.loadReviews('2');

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.map((r) => r.id)).toEqual(['1']);
    expect(reviewRepo.calls).toEqual(['2']);
  });

  it('crea una medida en el repositorio de medidas', async () => {
    const { id, ...newReview } = fakeReview(0, '2');
    void id;

    const result = await store.createReview(newReview);

    expect(result.ok).toBe(true);
    expect(reviewRepo.created.length).toBe(1);
  });

  it('guarda los cambios de una medida en el repositorio de medidas', async () => {
    const review = fakeReview(1, '2');

    const result = await store.updateReview(review);

    expect(result.ok).toBe(true);
    expect(reviewRepo.updated).toEqual([review]);
  });

  it('elimina una medida en el repositorio de medidas', async () => {
    const result = await store.deleteReview('1');

    expect(result.ok).toBe(true);
    expect(reviewRepo.deleted).toEqual(['1']);
  });
});
