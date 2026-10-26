import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { FakePatientRepository, fakePatient } from '../../testing/fake-patient.repository';
import { SearchPatientPage } from './search-patient.page';

describe('SearchPatientPage', () => {
  let repo: FakePatientRepository;
  let harness: RouterTestingHarness;

  async function open(url: string): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'search-patient', component: SearchPatientPage }], withComponentInputBinding()),
        { provide: PatientRepository, useValue: repo },
      ],
    });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle();
  }

  async function settle(): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  const el = () => harness.routeNativeElement as HTMLElement;
  const text = () => el().textContent ?? '';
  const rows = () => el().querySelectorAll('tbody tr');
  const router = () => TestBed.inject(Router);

  beforeEach(() => {
    repo = new FakePatientRepository();
    repo.patients = Array.from({ length: 30 }, (_, i) =>
      fakePatient(i + 1, i === 4 ? 'ANA TORRES' : `PACIENTE ${i + 1}`),
    );
  });

  it('muestra la primera página (25) y el total', async () => {
    await open('/search-patient');
    expect(rows().length).toBe(25);
    expect(text()).toContain('30 pacientes');
    expect(text()).toContain('Mostrando 1–25 de 30');
  });

  it('lee la búsqueda, la página y el tamaño de la URL', async () => {
    await open('/search-patient?page=2&size=10');
    expect(repo.calls.at(-1)).toEqual({ query: '', page: 2, pageSize: 10 });
    expect(rows().length).toBe(10);
  });

  it('un tamaño de página inválido vuelve al de 25', async () => {
    await open('/search-patient?size=7&page=abc');
    expect(repo.calls.at(-1)).toEqual({ query: '', page: 1, pageSize: 25 });
  });

  it('buscar con Enter pone el texto en la URL y vuelve a la página 1', async () => {
    await open('/search-patient?page=2&size=10');
    const input = el().querySelector<HTMLInputElement>('#patient-search')!;
    input.value = 'ana';
    input.dispatchEvent(new Event('input'));
    el().querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();

    expect(router().url).toBe('/search-patient?size=10&q=ana');
    expect(repo.calls.at(-1)).toEqual({ query: 'ana', page: 1, pageSize: 10 });
    expect(rows().length).toBe(1);
  });

  it('sin coincidencias muestra "Sin resultados" con el texto buscado', async () => {
    await open('/search-patient?q=zzz');
    expect(text()).toContain('Sin resultados');
    expect(text()).toContain('«zzz»');
    expect(el().querySelector('table')).toBeNull();
  });

  it('sin pacientes en absoluto invita a agregar uno', async () => {
    repo.patients = [];
    await open('/search-patient');
    expect(text()).toContain('Aún no hay pacientes');
  });

  it('un error de la red se muestra con "Reintentar"', async () => {
    repo.failWith = { kind: 'network', message: 'Sin conexión.' };
    await open('/search-patient');
    expect(el().querySelector('[role=alert]')?.textContent).toContain('Sin conexión.');

    repo.failWith = null;
    const retry = Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes('Reintentar'))!;
    retry.click();
    await settle();
    expect(rows().length).toBe(25);
    expect(el().querySelector('[role=alert]')).toBeNull();
  });

  it('una página fuera de rango salta a la última', async () => {
    await open('/search-patient?page=9');
    expect(router().url).toBe('/search-patient?page=2');
    expect(rows().length).toBe(5);
  });
});
