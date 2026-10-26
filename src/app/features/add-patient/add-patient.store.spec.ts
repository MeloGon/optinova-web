import { TestBed } from '@angular/core/testing';
import { appError } from '../../core/errors/app-error';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { FakePatientRepository, fakePatient } from '../../testing/fake-patient.repository';
import { AddPatientStore } from './add-patient.store';

const draft = { name: 'ANA LOPEZ', phone: '999111222', secondaryPhone: '', gender: '', birthDate: null, branch: 'MEDILENT', observations: '' };

describe('AddPatientStore', () => {
  let repo: FakePatientRepository;
  let store: AddPatientStore;

  beforeEach(() => {
    repo = new FakePatientRepository();
    repo.patients = Array.from({ length: 8 }, (_, i) => fakePatient(i + 1));
    TestBed.configureTestingModule({
      providers: [AddPatientStore, { provide: PatientRepository, useValue: repo }],
    });
    store = TestBed.inject(AddPatientStore);
  });

  it('carga solo los 5 pacientes más recientes', async () => {
    expect(store.hasLatest()).toBe(false);
    await store.loadLatest();
    expect(store.latest().length).toBe(5);
    expect(repo.calls.at(-1)).toEqual({ query: '', page: 1, pageSize: 5 });
    expect(store.hasLatest()).toBe(true);
  });

  it('crear devuelve el paciente con su ID y lo pone primero en recientes', async () => {
    const result = await store.create(draft);

    expect(result.ok).toBe(true);
    expect(repo.created).toEqual([draft]);
    expect(store.latest()[0].name).toBe('ANA LOPEZ');
    expect(store.saving()).toBe(false);
  });

  it('si crear falla devuelve el error y no toca los recientes', async () => {
    repo.createFailWith = appError('server', 'Falló.');

    const result = await store.create(draft);

    expect(result.ok).toBe(false);
    expect(store.latest()).toEqual([]);
    expect(store.saving()).toBe(false);
  });

  it('detecta pacientes con el mismo nombre sin distinguir mayúsculas', async () => {
    repo.patients = [fakePatient(1, 'ANA LOPEZ'), fakePatient(2, 'ANA TORRES')];

    const result = await store.findDuplicates('  ana lopez ');

    expect(result.ok && result.value.map((p) => p.id)).toEqual(['1']);
  });
});
