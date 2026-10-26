import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = TestBed.inject(ToastService);
  });

  afterEach(() => vi.useRealTimers());

  it('un éxito se cierra solo a los 5 segundos', () => {
    service.show({ tone: 'success', title: 'Guardado' });
    expect(service.toasts().length).toBe(1);
    vi.advanceTimersByTime(4999);
    expect(service.toasts().length).toBe(1);
    vi.advanceTimersByTime(1);
    expect(service.toasts().length).toBe(0);
  });

  it('un error se queda hasta que se cierra', () => {
    const id = service.show({ tone: 'danger', title: 'Falló' });
    vi.advanceTimersByTime(60_000);
    expect(service.toasts().length).toBe(1);
    service.dismiss(id);
    expect(service.toasts().length).toBe(0);
  });

  it('muestra como máximo 3: el más viejo sale primero', () => {
    for (const title of ['a', 'b', 'c', 'd']) service.show({ tone: 'danger', title });
    expect(service.toasts().map((t) => t.title)).toEqual(['b', 'c', 'd']);
  });
});
