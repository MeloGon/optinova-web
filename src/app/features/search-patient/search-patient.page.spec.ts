import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { ReviewRepository } from '../../core/repositories/review.repository';
import { FakePatientRepository, fakePatient } from '../../testing/fake-patient.repository';
import { FakeReviewRepository, fakeReview } from '../../testing/fake-review.repository';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { SearchPatientPage } from './search-patient.page';

describe('SearchPatientPage', () => {
  let repo: FakePatientRepository;
  let reviewRepo: FakeReviewRepository;
  let harness: RouterTestingHarness;

  async function open(url: string): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'search-patient', component: SearchPatientPage }], withComponentInputBinding()),
        { provide: PatientRepository, useValue: repo },
        { provide: ReviewRepository, useValue: reviewRepo },
      ],
    });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle();
  }

  async function settle(): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
    // Los diálogos del CDK viven en el overlay, fuera de la vista de la página: se refrescan con el tick.
    TestBed.inject(ApplicationRef).tick();
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
    reviewRepo = new FakeReviewRepository();
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

  const toasts = () => TestBed.inject(ToastService).toasts();
  const byText = (root: ParentNode, selector: string, label: string) =>
    Array.from(root.querySelectorAll<HTMLElement>(selector)).find((e) => e.textContent?.includes(label))!;

  /** Abre el menú ⋯ de la primera fila y elige la acción. */
  async function openMenuAction(label: string): Promise<void> {
    el().querySelector<HTMLButtonElement>('tbody button[aria-label^="Más acciones"]')!.click();
    await settle();
    byText(document.body, '[cdkMenuItem]', label).click();
    await settle();
  }

  /** "Editar" ya es un ícono visible en la fila (P-03), no vive en el menú ⋯. */
  async function openEditPatient(): Promise<void> {
    el().querySelector<HTMLButtonElement>('tbody button[aria-label^="Editar "]')!.click();
    await settle();
  }

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = '')));

  describe('editar', () => {
    const dialog = () => document.body.querySelector('[role=dialog]');
    const field = (id: string) => document.body.querySelector<HTMLInputElement>(`#${id}`)!;
    const type = (id: string, value: string) => {
      field(id).value = value;
      field(id).dispatchEvent(new Event('input'));
      field(id).dispatchEvent(new Event('blur'));
    };
    const save = async () => {
      document.body.querySelector('[role=dialog] form')!.dispatchEvent(new Event('submit'));
      await settle();
    };

    beforeEach(() => {
      repo.patients[0] = {
        ...repo.patients[0],
        phone: '999111222',
        secondaryPhone: '014567890',
        gender: 'Femenino',
        birthDate: '1990-05-17',
      };
    });

    it('abre con los datos actuales del paciente', async () => {
      await open('/search-patient');
      await openEditPatient();

      expect(dialog()).not.toBeNull();
      expect(field('patient-name').value).toBe('PACIENTE 1');
      expect(field('patient-phone').value).toBe('999111222');
      expect(field('patient-phone-2').value).toBe('014567890');
      expect(field('patient-gender').value).toBe('Femenino');
      expect(field('patient-birth').value).toBe('17/05/1990');
      expect(field('patient-branch').value).toBe('OFTALVISION');
    });

    it('guarda los cambios (sin espacios sobrantes), cierra, refresca la lista y avisa', async () => {
      await open('/search-patient');
      await openEditPatient();
      type('patient-name', '  MARIA NUEVA  ');
      type('patient-birth', '');
      await save();

      expect(repo.updated.length).toBe(1);
      expect(repo.updated[0]).toMatchObject({
        id: '1',
        name: 'MARIA NUEVA',
        birthDate: null,
        phone: '999111222',
        secondaryPhone: '014567890',
      });
      expect(dialog()).toBeNull();
      expect(text()).toContain('MARIA NUEVA');
      expect(toasts().map((t) => t.title)).toEqual(['Paciente actualizado']);
    });

    it('sin nombre muestra el error y no guarda', async () => {
      await open('/search-patient');
      await openEditPatient();
      type('patient-name', '   ');
      await save();

      expect(document.body.textContent).toContain('Escribe el nombre del paciente.');
      expect(repo.updated).toEqual([]);
      expect(dialog()).not.toBeNull();
    });

    it('una fecha de nacimiento futura no se acepta', async () => {
      await open('/search-patient');
      await openEditPatient();
      type('patient-birth', '01/01/2999');
      await save();

      expect(document.body.textContent).toContain('No puede ser una fecha futura.');
      expect(repo.updated).toEqual([]);
    });

    it('si el servidor falla, el diálogo sigue abierto con el error y sin aviso de éxito', async () => {
      repo.updateFailWith = { kind: 'server', message: 'No se pudo guardar.' };
      await open('/search-patient');
      await openEditPatient();
      await save();

      expect(dialog()!.querySelector('[role=alert]')?.textContent).toContain('No se pudo guardar.');
      expect(toasts()).toEqual([]);
    });

    it('cancelar cierra sin guardar', async () => {
      await open('/search-patient');
      await openEditPatient();
      byText(document.body, '[role=dialog] button', 'Cancelar').click();
      await settle();

      expect(dialog()).toBeNull();
      expect(repo.updated).toEqual([]);
      expect(toasts()).toEqual([]);
    });

    it('una sucursal cerrada del paciente se conserva en la lista', async () => {
      repo.patients[0] = { ...repo.patients[0], branch: 'OFTALMIC CENTER' };
      await open('/search-patient');
      await openEditPatient();

      expect(field('patient-branch').value).toBe('OFTALMIC CENTER');
      expect(document.body.textContent).toContain('OFTALMIC CENTER (cerrada)');
    });
  });

  describe('ver medidas', () => {
    const dialog = () => document.body.querySelector('[role=dialog]');

    it('carga y muestra las medidas del paciente', async () => {
      reviewRepo.reviews = [
        fakeReview(1, '1', { date: '2026-09-01', odEsf: '-1.00', reasonConsult: 'Revisión anual' }),
      ];
      await open('/search-patient');
      await openMenuAction('Ver medidas');

      expect(dialog()).not.toBeNull();
      expect(reviewRepo.calls).toEqual(['1']);
      expect(dialog()!.textContent).toContain('Revisión anual');
      // P-05 Graduación: signo menos tipográfico (−), no el guion ASCII.
      expect(dialog()!.textContent).toContain('−1.00');
    });

    it('sin medidas avisa con un toast y no abre el diálogo (= Flutter: no abre si la lista viene vacía)', async () => {
      await open('/search-patient');
      await openMenuAction('Ver medidas');

      expect(dialog()).toBeNull();
      expect(toasts().map((t) => ({ tone: t.tone, title: t.title, text: t.text }))).toEqual([
        { tone: 'info', title: 'Sin medidas', text: 'Este paciente no tiene medidas registradas.' },
      ]);
    });

    it('si falla la carga, avisa con un toast de error y no abre el diálogo', async () => {
      reviewRepo.getFailWith = { kind: 'server', message: 'Falló.' };
      await open('/search-patient');
      await openMenuAction('Ver medidas');

      expect(dialog()).toBeNull();
      expect(toasts().map((t) => t.tone)).toEqual(['danger']);
    });

    it('eliminar una medida pide confirmación, la quita de la lista y avisa', async () => {
      reviewRepo.reviews = [fakeReview(1, '1', { date: '2026-09-01' }), fakeReview(2, '1', { date: '2026-08-01' })];
      await open('/search-patient');
      await openMenuAction('Ver medidas');

      document.body.querySelectorAll<HTMLButtonElement>('[aria-label^="Eliminar medida"]')[0].click();
      await settle();
      byText(document.body, '[role=alertdialog] button', 'Eliminar medida').click();
      await settle();

      expect(reviewRepo.deleted).toEqual(['1']);
      expect(document.body.querySelectorAll('[aria-label^="Eliminar medida"]').length).toBe(1);
      expect(toasts().map((t) => t.title)).toContain('Medida eliminada');
    });

    it('si eliminar falla, avisa del error y no la quita de la lista', async () => {
      reviewRepo.reviews = [fakeReview(1, '1')];
      reviewRepo.deleteFailWith = { kind: 'server', message: 'No se pudo.' };
      await open('/search-patient');
      await openMenuAction('Ver medidas');

      document.body.querySelector<HTMLButtonElement>('[aria-label^="Eliminar medida"]')!.click();
      await settle();
      byText(document.body, '[role=alertdialog] button', 'Eliminar medida').click();
      await settle();

      expect(document.body.querySelectorAll('[aria-label^="Eliminar medida"]').length).toBe(1);
      expect(toasts().map((t) => t.tone)).toEqual(['danger']);
    });

    it('editar una medida la guarda y recarga la lista', async () => {
      reviewRepo.reviews = [fakeReview(1, '1', { odEsf: '-1.00' })];
      await open('/search-patient');
      await openMenuAction('Ver medidas');

      document.body.querySelector<HTMLButtonElement>('[aria-label^="Editar medida"]')!.click();
      await settle();

      const field = document.body.querySelector<HTMLInputElement>('[aria-label="ESF OD"]')!;
      field.value = '-1.50';
      field.dispatchEvent(new Event('input'));
      document.body.querySelector('[role=dialog] form')!.dispatchEvent(new Event('submit'));
      await settle();

      expect(reviewRepo.updated.at(-1)?.odEsf).toBe('-1.50');
      expect(toasts().map((t) => t.title)).toContain('Medida actualizada');
    });

    it('EJE fuera de rango bloquea el guardado y muestra el error (P-05)', async () => {
      reviewRepo.reviews = [fakeReview(1, '1')];
      await open('/search-patient');
      await openMenuAction('Ver medidas');

      document.body.querySelector<HTMLButtonElement>('[aria-label^="Editar medida"]')!.click();
      await settle();

      const field = document.body.querySelector<HTMLInputElement>('[aria-label="EJE OD"]')!;
      field.value = '200';
      field.dispatchEvent(new Event('input'));
      field.dispatchEvent(new Event('blur'));
      document.body.querySelector('[role=dialog] form')!.dispatchEvent(new Event('submit'));
      await settle();

      expect(reviewRepo.updated).toEqual([]);
      expect(document.body.querySelector('[role=dialog]')).not.toBeNull();
      expect(document.body.textContent).toContain('OD · EJE: debe estar entre 0 y 180.');
    });
  });

  describe('agregar medida', () => {
    const dialog = () => document.body.querySelector('[role=dialog]');
    const save = async () => {
      document.body.querySelector('[role=dialog] form')!.dispatchEvent(new Event('submit'));
      await settle();
    };

    it('crea la medida con el paciente y la fecha de hoy, cierra y avisa', async () => {
      await open('/search-patient');
      await openMenuAction('Agregar medida');
      expect(dialog()).not.toBeNull();

      const field = document.body.querySelector<HTMLInputElement>('[aria-label="ESF OD"]')!;
      field.value = '-2.00';
      field.dispatchEvent(new Event('input'));
      await save();

      expect(reviewRepo.created.length).toBe(1);
      expect(reviewRepo.created[0]).toMatchObject({ patientId: '1', odEsf: '-2.00' });
      expect(dialog()).toBeNull();
      expect(toasts().map((t) => t.title)).toEqual(['Medida agregada']);
    });

    it('si el servidor falla, el diálogo sigue abierto con el error', async () => {
      reviewRepo.createFailWith = { kind: 'server', message: 'No se pudo guardar.' };
      await open('/search-patient');
      await openMenuAction('Agregar medida');
      await save();

      expect(dialog()!.querySelector('[role=alert]')?.textContent).toContain('No se pudo guardar.');
      expect(toasts()).toEqual([]);
    });
  });

  describe('eliminar', () => {
    const openDeleteDialog = () => openMenuAction('Eliminar');

    it('pide confirmación con el nombre del paciente y no borra aún', async () => {
      await open('/search-patient');
      await openDeleteDialog();

      const dialog = document.body.querySelector('[role=alertdialog]')!;
      expect(dialog.textContent).toContain('¿Eliminar a PACIENTE 1?');
      expect(repo.deleted).toEqual([]);
    });

    it('cancelar no borra nada', async () => {
      await open('/search-patient');
      await openDeleteDialog();
      byText(document.body, '[role=alertdialog] button', 'Cancelar').click();
      await settle();

      expect(repo.deleted).toEqual([]);
      expect(document.body.querySelector('[role=alertdialog]')).toBeNull();
      expect(toasts()).toEqual([]);
    });

    it('confirmar borra, actualiza la lista y avisa', async () => {
      await open('/search-patient');
      await openDeleteDialog();
      byText(document.body, '[role=alertdialog] button', 'Eliminar paciente').click();
      await settle();

      expect(repo.deleted).toEqual(['1']);
      expect(text()).toContain('29 pacientes');
      expect(toasts().map((t) => t.title)).toEqual(['Paciente eliminado']);
    });

    it('si falla, avisa del error y deja la lista como estaba', async () => {
      repo.deleteFailWith = { kind: 'unauthorized', message: 'Sin permiso.' };
      await open('/search-patient');
      await openDeleteDialog();
      byText(document.body, '[role=alertdialog] button', 'Eliminar paciente').click();
      await settle();

      expect(toasts().map((t) => t.tone)).toEqual(['danger']);
      expect(toasts()[0].text).toBe('Sin permiso.');
      expect(text()).toContain('30 pacientes');
    });
  });

  it('una página fuera de rango salta a la última', async () => {
    await open('/search-patient?page=9');
    expect(router().url).toBe('/search-patient?page=2');
    expect(rows().length).toBe(5);
  });
});
