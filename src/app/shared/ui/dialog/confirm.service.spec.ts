import { Dialog } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { EMPTY, Observable, of } from 'rxjs';
import { ConfirmService } from './confirm.service';

describe('ConfirmService', () => {
  let openedWith: { data?: unknown; disableClose?: boolean; role?: string } | null;

  /** Dialog falso: el "usuario" responde lo que devuelva `closed`. */
  function setup(closed: Observable<unknown>): ConfirmService {
    openedWith = null;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: Dialog,
          useValue: {
            open: (_component: unknown, config: typeof openedWith) => {
              openedWith = config;
              return { closed };
            },
          },
        },
      ],
    });
    return TestBed.inject(ConfirmService);
  }

  const options = { title: '¿Eliminar a ANA?', text: 'No se puede deshacer.', confirmLabel: 'Eliminar paciente' };

  it('confirmar resuelve true', async () => {
    expect(await setup(of(true)).confirm(options)).toBe(true);
  });

  it('cancelar resuelve false', async () => {
    expect(await setup(of(false)).confirm(options)).toBe(false);
  });

  it('si el diálogo se cierra sin respuesta, resuelve false (nunca confirma por omisión)', async () => {
    expect(await setup(EMPTY).confirm(options)).toBe(false);
  });

  it('un valor que no es exactamente true no cuenta como confirmación', async () => {
    expect(await setup(of('true')).confirm(options)).toBe(false);
    expect(await setup(of(undefined)).confirm(options)).toBe(false);
  });

  it('abre un alertdialog con las opciones y sin cerrar por el velo', async () => {
    await setup(of(true)).confirm(options);

    expect(openedWith?.data).toEqual(options);
    expect(openedWith?.role).toBe('alertdialog');
    expect(openedWith?.disableClose).toBe(true);
  });
});
