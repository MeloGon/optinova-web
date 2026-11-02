import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { SessionStore } from '../../core/auth/session.store';
import { Role } from '../../core/models/role';
import { PatientLifecycleRepository } from '../../core/repositories/patient-lifecycle.repository';
import { AuthRepository } from '../../core/repositories/auth.repository';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { ReviewRepository } from '../../core/repositories/review.repository';
import { FakeAuthRepository, fakeProfile } from '../../testing/fake-auth.repository';
import { FAKE_SUPERVISOR, FakePatientLifecycleRepository } from '../../testing/fake-patient-lifecycle.repository';
import { FakePatientRepository, fakePatient } from '../../testing/fake-patient.repository';
import { FakeReviewRepository, fakeReview } from '../../testing/fake-review.repository';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { SearchPatientPage } from './search-patient.page';

describe('SearchPatientPage', () => {
  let repo: FakePatientRepository;
  let reviewRepo: FakeReviewRepository;
  let lifecycleRepo: FakePatientLifecycleRepository;
  let harness: RouterTestingHarness;

  /** `role` deja sesión iniciada (= AddPatientPage de Flutter con un usuario de ese rol); sin ella, el perfil queda null. */
  async function open(url: string, role?: Role): Promise<void> {
    const auth = new FakeAuthRepository();
    if (role) auth.session = fakeProfile(role);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'search-patient', component: SearchPatientPage }], withComponentInputBinding()),
        { provide: PatientRepository, useValue: repo },
        { provide: ReviewRepository, useValue: reviewRepo },
        { provide: PatientLifecycleRepository, useValue: lifecycleRepo },
        { provide: AuthRepository, useValue: auth },
      ],
    });
    if (role) await TestBed.inject(SessionStore).restore();
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
    lifecycleRepo = new FakePatientLifecycleRepository(repo);
  });

  it('muestra la primera página (25) y el total', async () => {
    await open('/search-patient');
    expect(rows().length).toBe(25);
    expect(text()).toContain('30 pacientes');
    expect(text()).toContain('Mostrando 1–25 de 30');
  });

  it('lee la búsqueda, la página y el tamaño de la URL', async () => {
    await open('/search-patient?page=2&size=10');
    expect(repo.calls.at(-1)).toEqual({ query: '', page: 2, pageSize: 10, archived: false });
    expect(rows().length).toBe(10);
  });

  it('un tamaño de página inválido vuelve al de 25', async () => {
    await open('/search-patient?size=7&page=abc');
    expect(repo.calls.at(-1)).toEqual({ query: '', page: 1, pageSize: 25, archived: false });
  });

  it('buscar con Enter pone el texto en la URL y vuelve a la página 1', async () => {
    await open('/search-patient?page=2&size=10');
    const input = el().querySelector<HTMLInputElement>('#patient-search')!;
    input.value = 'ana';
    input.dispatchEvent(new Event('input'));
    el().querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();

    expect(router().url).toBe('/search-patient?size=10&q=ana');
    expect(repo.calls.at(-1)).toEqual({ query: 'ana', page: 1, pageSize: 10, archived: false });
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

  describe('agregar paciente', () => {
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
    const openAddPatient = async () => {
      byText(el(), 'form button', 'Agregar paciente').click();
      await settle();
    };

    it('abre vacío, con la sucursal del usuario fija (= AddPatientPage de Flutter, antes una página propia)', async () => {
      await open('/search-patient', 'vendedor');
      await openAddPatient();

      expect(dialog()).not.toBeNull();
      expect(field('new-patient-name').value).toBe('');
      expect(field('new-patient-branch').value).toBe('OFTALVISION');
      expect(field('new-patient-branch').disabled).toBe(true);
    });

    it('un admin sí puede cambiar la sucursal', async () => {
      await open('/search-patient', 'admin');
      await openAddPatient();

      expect(field('new-patient-branch').disabled).toBe(false);
    });

    it('sin datos muestra los errores y no crea nada', async () => {
      await open('/search-patient', 'vendedor');
      await openAddPatient();
      await save();

      expect(document.body.textContent).toContain('Escribe el nombre del paciente.');
      expect(document.body.textContent).toContain('Escribe un teléfono.');
      expect(repo.created).toEqual([]);
    });

    it('rechaza teléfonos con letras o muy cortos', async () => {
      await open('/search-patient', 'vendedor');
      await openAddPatient();
      type('new-patient-name', 'ANA');
      type('new-patient-phone', 'abc123');
      await save();

      expect(document.body.textContent).toContain('Escribe un teléfono válido');
      expect(repo.created).toEqual([]);
    });

    it('el teléfono secundario es opcional, pero si se escribe debe ser válido', async () => {
      await open('/search-patient', 'vendedor');
      await openAddPatient();
      type('new-patient-name', 'ANA');
      type('new-patient-phone', '999111222');
      type('new-patient-phone-2', 'xx');
      await save();

      expect(document.body.textContent).toContain('Escribe un teléfono válido');
      expect(repo.created).toEqual([]);
    });

    it('rechaza una fecha de nacimiento futura', async () => {
      await open('/search-patient', 'vendedor');
      await openAddPatient();
      type('new-patient-name', 'ANA');
      type('new-patient-phone', '999111222');
      type('new-patient-birth', '01/01/2999');
      await save();

      expect(document.body.textContent).toContain('No puede ser una fecha futura.');
      expect(repo.created).toEqual([]);
    });

    it('guarda con nombre y notas en mayúsculas, espacios limpios y sin nacimiento', async () => {
      await open('/search-patient', 'vendedor');
      await openAddPatient();
      type('new-patient-name', 'ana  maría lópez');
      type('new-patient-phone', '999 111 222');
      type('new-patient-notes', ' usa lentes ');
      await save();

      expect(repo.created).toEqual([
        {
          name: 'ANA MARÍA LÓPEZ',
          phone: '999 111 222',
          secondaryPhone: '',
          gender: '',
          birthDate: null,
          branch: 'OFTALVISION',
          observations: 'USA LENTES',
        },
      ]);
    });

    it('cierra, refresca la lista y avisa', async () => {
      await open('/search-patient', 'vendedor');
      await openAddPatient();
      type('new-patient-name', 'ana lopez');
      type('new-patient-phone', '999111222');
      await save();

      expect(dialog()).toBeNull();
      expect(toasts().map((t) => t.title)).toEqual(['Paciente creado']);
      expect(text()).toContain('ANA LOPEZ');
    });

    it('con un nombre repetido pide confirmar, y cancelar no crea', async () => {
      await open('/search-patient', 'vendedor'); // repo.patients[4] = 'ANA TORRES'
      await openAddPatient();
      type('new-patient-name', 'ana torres');
      type('new-patient-phone', '999111222');
      await save();

      const confirmDialog = document.body.querySelector('[role=alertdialog]')!;
      expect(confirmDialog.textContent).toContain('Ya existe un paciente llamado ANA TORRES');
      byText(document.body, '[role=alertdialog] button', 'Cancelar').click();
      await settle();

      expect(repo.created).toEqual([]);
      expect(dialog()).not.toBeNull();
    });

    it('con un nombre repetido, confirmar sí crea', async () => {
      await open('/search-patient', 'vendedor');
      await openAddPatient();
      type('new-patient-name', 'ana torres');
      type('new-patient-phone', '999111222');
      await save();
      byText(document.body, '[role=alertdialog] button', 'Crear de todos modos').click();
      await settle();

      expect(repo.created.map((p) => p.name)).toEqual(['ANA TORRES']);
      expect(toasts().map((t) => t.title)).toEqual(['Paciente creado']);
    });

    it('si el servidor falla, el diálogo sigue abierto con el error y sin aviso de éxito', async () => {
      repo.createFailWith = { kind: 'server', message: 'No se pudo guardar.' };
      await open('/search-patient', 'vendedor');
      await openAddPatient();
      type('new-patient-name', 'ana lopez');
      type('new-patient-phone', '999111222');
      await save();

      expect(dialog()!.querySelector('[role=alert]')?.textContent).toContain('No se pudo guardar.');
      expect(toasts()).toEqual([]);
    });

    it('cancelar cierra sin crear', async () => {
      await open('/search-patient', 'vendedor');
      await openAddPatient();
      byText(document.body, '[role=dialog] button', 'Cancelar').click();
      await settle();

      expect(dialog()).toBeNull();
      expect(repo.created).toEqual([]);
      expect(toasts()).toEqual([]);
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

    it('sin medidas ni ventas: pide confirmación con el nombre del paciente y no borra aún', async () => {
      await open('/search-patient');
      await openDeleteDialog();

      const dialog = document.body.querySelector('[role=alertdialog]')!;
      expect(dialog.textContent).toContain('¿Eliminar a PACIENTE 1?');
      expect(lifecycleRepo.deleted).toEqual([]);
    });

    it('cancelar no borra nada', async () => {
      await open('/search-patient');
      await openDeleteDialog();
      byText(document.body, '[role=alertdialog] button', 'Cancelar').click();
      await settle();

      expect(lifecycleRepo.deleted).toEqual([]);
      expect(document.body.querySelector('[role=alertdialog]')).toBeNull();
      expect(toasts()).toEqual([]);
    });

    it('confirmar borra, actualiza la lista y avisa', async () => {
      await open('/search-patient');
      await openDeleteDialog();
      byText(document.body, '[role=alertdialog] button', 'Eliminar paciente').click();
      await settle();

      expect(lifecycleRepo.deleted).toEqual(['1']);
      expect(text()).toContain('29 pacientes');
      expect(toasts().map((t) => t.title)).toEqual(['Paciente eliminado']);
    });

    it('si falla, avisa del error y deja la lista como estaba', async () => {
      lifecycleRepo.applyFailWith = { kind: 'unauthorized', message: 'Sin permiso.' };
      await open('/search-patient');
      await openDeleteDialog();
      byText(document.body, '[role=alertdialog] button', 'Eliminar paciente').click();
      await settle();

      expect(toasts().map((t) => t.tone)).toEqual(['danger']);
      expect(toasts()[0].text).toBe('Sin permiso.');
      expect(text()).toContain('30 pacientes');
    });

    it('si no se puede revisar el historial, avisa y no abre ningún diálogo', async () => {
      lifecycleRepo.resolveFailWith = { kind: 'network', message: 'Sin conexión.' };
      await open('/search-patient');
      await openDeleteDialog();

      expect(document.body.querySelector('[role=alertdialog]')).toBeNull();
      expect(toasts().map((t) => t.title)).toEqual(['No se pudo revisar el historial']);
    });

    it('con medidas y un supervisor+ que llama, borra paciente y medidas sin pedir más', async () => {
      lifecycleRepo.statuses['1'] = { tier: 'reviews', reviewCount: 2, saleCount: 0 };
      await open('/search-patient', 'supervisor');
      await openDeleteDialog();

      const dialog = document.body.querySelector('[role=alertdialog]')!;
      expect(dialog.textContent).toContain('2 medidas');
      byText(document.body, '[role=alertdialog] button', 'Eliminar paciente').click();
      await settle();

      expect(lifecycleRepo.applied).toEqual([{ patientId: '1', supervisor: undefined }]);
      expect(toasts().map((t) => t.title)).toEqual(['Paciente eliminado']);
    });

    it('con medidas y un vendedor que llama, pide correo y contraseña de un supervisor (P-04)', async () => {
      lifecycleRepo.statuses['1'] = { tier: 'reviews', reviewCount: 1, saleCount: 0 };
      await open('/search-patient', 'vendedor');
      await openDeleteDialog();

      expect(document.body.querySelector('[role=alertdialog]')).toBeNull();
      const dialog = document.body.querySelector('[role=dialog]')!;
      expect(dialog.textContent).toContain('PACIENTE 1');
      expect(dialog.textContent).toContain('1 medida');

      const email = document.body.querySelector<HTMLInputElement>('#supervisor-email')!;
      const password = document.body.querySelector<HTMLInputElement>('#supervisor-password')!;
      email.value = FAKE_SUPERVISOR.email;
      email.dispatchEvent(new Event('input'));
      password.value = 'mala';
      password.dispatchEvent(new Event('input'));
      document.body.querySelector('[role=dialog] form')!.dispatchEvent(new Event('submit'));
      await settle();

      expect(document.body.querySelector('[role=dialog] [role=alert]')?.textContent).toContain(
        'Correo o contraseña incorrectos.',
      );

      password.value = FAKE_SUPERVISOR.password;
      password.dispatchEvent(new Event('input'));
      document.body.querySelector('[role=dialog] form')!.dispatchEvent(new Event('submit'));
      await settle();

      expect(document.body.querySelector('[role=dialog]')).toBeNull();
      expect(toasts().map((t) => t.title)).toEqual(['Paciente eliminado']);
    });

    it('con ventas y un admin que llama, archiva en vez de eliminar', async () => {
      lifecycleRepo.statuses['1'] = { tier: 'sales', reviewCount: 0, saleCount: 3 };
      await open('/search-patient', 'admin');
      await openDeleteDialog();

      const dialog = document.body.querySelector('[role=alertdialog]')!;
      expect(dialog.textContent).toContain('¿Archivar a PACIENTE 1?');
      byText(document.body, '[role=alertdialog] button', 'Archivar paciente').click();
      await settle();

      expect(lifecycleRepo.archived).toEqual(['1']);
      expect(toasts().map((t) => t.title)).toEqual(['Paciente archivado']);
    });

    it('con ventas y un vendedor o supervisor que llama, bloquea sin abrir ningún diálogo', async () => {
      lifecycleRepo.statuses['1'] = { tier: 'sales', reviewCount: 0, saleCount: 1 };
      await open('/search-patient', 'supervisor');
      await openDeleteDialog();

      expect(document.body.querySelector('[role=alertdialog]')).toBeNull();
      expect(document.body.querySelector('[role=dialog]')).toBeNull();
      expect(lifecycleRepo.applied).toEqual([]);
      expect(toasts().map((t) => t.title)).toEqual(['No se puede eliminar']);
    });
  });

  describe('ver archivados', () => {
    beforeEach(() => {
      repo.patients[0] = { ...repo.patients[0], archivedOn: '2026-10-20' };
    });

    it('el botón no aparece para un vendedor', async () => {
      await open('/search-patient', 'vendedor');
      expect(byText(el(), 'button', 'Ver archivados')).toBeUndefined();
    });

    it('el botón aparece para un admin', async () => {
      await open('/search-patient', 'admin');
      expect(byText(el(), 'button', 'Ver archivados')).not.toBeUndefined();
    });

    it('activa el filtro, muestra solo archivados y cambia las acciones por Restaurar', async () => {
      await open('/search-patient', 'admin');
      byText(el(), 'button', 'Ver archivados').click();
      await settle();

      expect(router().url).toContain('archived=1');
      expect(repo.calls.at(-1)?.archived).toBe(true);
      expect(rows().length).toBe(1);
      expect(text()).toContain('PACIENTE 1');
      expect(el().querySelector('[aria-label^="Editar"]')).toBeNull();
    });

    it('restaurar avisa y recarga la lista', async () => {
      await open('/search-patient?archived=1', 'admin');
      byText(el(), 'tbody button', 'Restaurar').click();
      await settle();
      byText(document.body, '[role=alertdialog] button', 'Restaurar paciente').click();
      await settle();

      expect(lifecycleRepo.restored).toEqual(['1']);
      expect(toasts().map((t) => t.title)).toEqual(['Paciente restaurado']);
    });
  });

  it('una página fuera de rango salta a la última', async () => {
    await open('/search-patient?page=9');
    expect(router().url).toBe('/search-patient?page=2');
    expect(rows().length).toBe(5);
  });
});
