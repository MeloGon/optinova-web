import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { SessionStore } from '../../core/auth/session.store';
import { Role } from '../../core/models/role';
import { AuthRepository } from '../../core/repositories/auth.repository';
import { PatientRepository } from '../../core/repositories/patient.repository';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { FakeAuthRepository, fakeProfile } from '../../testing/fake-auth.repository';
import { FakePatientRepository, fakePatient } from '../../testing/fake-patient.repository';
import { AddPatientPage } from './add-patient.page';

describe('AddPatientPage', () => {
  let repo: FakePatientRepository;
  let harness: RouterTestingHarness;

  async function open(role: Role = 'vendedor'): Promise<void> {
    const auth = new FakeAuthRepository();
    auth.session = fakeProfile(role);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'add-patient', component: AddPatientPage }], withComponentInputBinding()),
        { provide: PatientRepository, useValue: repo },
        { provide: AuthRepository, useValue: auth },
      ],
    });
    await TestBed.inject(SessionStore).restore();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/add-patient');
    await settle();
  }

  async function settle(): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
    TestBed.inject(ApplicationRef).tick();
  }

  const el = () => harness.routeNativeElement as HTMLElement;
  const text = () => el().textContent ?? '';
  const field = (id: string) => document.body.querySelector<HTMLInputElement>(`#${id}`)!;
  const toasts = () => TestBed.inject(ToastService).toasts();
  const byText = (selector: string, label: string) =>
    Array.from(document.body.querySelectorAll<HTMLElement>(selector)).find((e) => e.textContent?.includes(label))!;

  async function type(id: string, value: string): Promise<void> {
    field(id).value = value;
    field(id).dispatchEvent(new Event('input'));
    field(id).dispatchEvent(new Event('change'));
    field(id).dispatchEvent(new Event('blur'));
    await settle();
  }

  async function submit(): Promise<void> {
    el().querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
  }

  async function fillValid(): Promise<void> {
    await type('new-name', 'ana  maría lópez');
    await type('new-phone', '999 111 222');
  }

  beforeEach(() => {
    repo = new FakePatientRepository();
    repo.patients = [fakePatient(1, 'JUAN GARCIA'), fakePatient(2, 'ELENA TORRES')];
  });

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = '')));

  it('empieza con la sucursal del usuario y muestra los últimos pacientes', async () => {
    await open('vendedor');
    expect(field('new-branch').value).toBe('OFTALVISION');
    expect(text()).toContain('Últimos pacientes agregados');
    expect(text()).toContain('JUAN GARCIA');
    expect(el().querySelector('a[href*="/dashboard/sell"]')).not.toBeNull();
  });

  it('un vendedor no puede cambiar la sucursal; un admin sí', async () => {
    await open('vendedor');
    expect(field('new-branch').disabled).toBe(true);
  });

  it('un admin sí puede cambiar la sucursal', async () => {
    await open('admin');
    expect(field('new-branch').disabled).toBe(false);
  });

  it('sin datos muestra los errores y no crea nada', async () => {
    await open();
    await submit();

    expect(text()).toContain('Escribe el nombre del paciente.');
    expect(text()).toContain('Escribe un teléfono.');
    expect(repo.created).toEqual([]);
  });

  it('rechaza teléfonos con letras o muy cortos', async () => {
    await open();
    await type('new-name', 'ANA');
    await type('new-phone', 'abc123');
    await submit();
    expect(text()).toContain('Escribe un teléfono válido');

    await type('new-phone', '12345');
    await submit();
    expect(text()).toContain('Escribe un teléfono válido');
    expect(repo.created).toEqual([]);
  });

  it('rechaza una fecha de nacimiento futura', async () => {
    await open();
    await fillValid();
    await type('new-birth', '2999-01-01');
    await submit();

    expect(text()).toContain('No puede ser una fecha futura.');
    expect(repo.created).toEqual([]);
  });

  it('guarda con nombre y notas en mayúsculas, espacios limpios y sin nacimiento', async () => {
    await open();
    await fillValid();
    await type('new-notes', ' usa lentes ');
    await submit();

    expect(repo.created).toEqual([
      {
        name: 'ANA MARÍA LÓPEZ',
        phone: '999 111 222',
        gender: '',
        birthDate: null,
        branch: 'OFTALVISION',
        observations: 'USA LENTES',
      },
    ]);
  });

  it('al guardar avisa, limpia el formulario y suma al paciente a recientes', async () => {
    await open();
    await fillValid();
    await submit();

    expect(toasts().map((t) => t.title)).toEqual(['Paciente creado']);
    expect(field('new-name').value).toBe('');
    expect(field('new-branch').value).toBe('OFTALVISION');
    expect(text()).toContain('ANA MARÍA LÓPEZ');
  });

  it('el género es opcional y se puede quitar volviendo a pulsarlo', async () => {
    await open();
    await fillValid();
    byText('onv-segmented button', 'Femenino').click();
    await settle();
    expect(text()).toContain('Femenino');
    byText('onv-segmented button', 'Femenino').click();
    await settle();
    await submit();

    expect(repo.created[0].gender).toBe('');
  });

  it('con un nombre repetido pide confirmar, y cancelar no crea', async () => {
    await open();
    await type('new-name', 'juan garcia');
    await type('new-phone', '999111222');
    await submit();

    const dialog = document.body.querySelector('[role=alertdialog]')!;
    expect(dialog.textContent).toContain('Ya existe un paciente llamado JUAN GARCIA');
    byText('[role=alertdialog] button', 'Cancelar').click();
    await settle();

    expect(repo.created).toEqual([]);
    expect(field('new-name').value).toBe('juan garcia');
  });

  it('con un nombre repetido, confirmar sí crea', async () => {
    await open();
    await type('new-name', 'juan garcia');
    await type('new-phone', '999111222');
    await submit();
    byText('[role=alertdialog] button', 'Crear de todos modos').click();
    await settle();

    expect(repo.created.map((p) => p.name)).toEqual(['JUAN GARCIA']);
    expect(toasts().map((t) => t.title)).toEqual(['Paciente creado']);
  });

  it('si el servidor falla avisa del error y conserva lo escrito', async () => {
    repo.createFailWith = { kind: 'server', message: 'No se pudo guardar.' };
    await open();
    await fillValid();
    await submit();

    expect(toasts().map((t) => t.tone)).toEqual(['danger']);
    expect(toasts()[0].text).toBe('No se pudo guardar.');
    expect(field('new-name').value).toBe('ana  maría lópez');
  });

  it('la vista previa sigue lo que se escribe', async () => {
    await open();
    await type('new-name', 'ana lopez');
    await type('new-phone', '555');

    const summary = el().querySelector('aside')!.textContent!;
    expect(summary).toContain('ANA LOPEZ');
    expect(summary).toContain('AL');
    expect(summary).toContain('555');
  });

  it('"Limpiar" borra lo escrito', async () => {
    await open();
    await fillValid();
    byText('button', 'Limpiar').click();
    await settle();

    expect(field('new-name').value).toBe('');
    expect(field('new-phone').value).toBe('');
  });
});
