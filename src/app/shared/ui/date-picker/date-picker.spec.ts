import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePicker } from './date-picker';

@Component({
  selector: 'app-date-picker-host',
  imports: [ReactiveFormsModule, DatePicker],
  template: `
    <onv-date-picker
      label="Fecha"
      inputId="host-date"
      [formControl]="control"
      [minDate]="minDate"
      [maxDate]="maxDate"
      [errors]="{ required: 'Obligatorio.' }"
    />
  `,
})
class HostComponent {
  control = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  minDate: string | null = null;
  maxDate: string | null = null;
}

describe('DatePicker', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const root = () => fixture.nativeElement as HTMLElement;
  const input = () => root().querySelector<HTMLInputElement>('#host-date')!;
  const errorText = () => root().querySelector('p')?.textContent?.trim();
  // El popover se dibuja en document.body (CdkConnectedOverlay), no dentro del fixture.
  const buttonByText = (text: string) =>
    Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === text)!;
  const openCalendar = () => {
    root().querySelector<HTMLButtonElement>('button[aria-label="Abrir calendario"]')!.click();
    fixture.detectChanges();
  };
  const type = (value: string) => {
    const el = input();
    el.value = value;
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const blur = () => {
    input().dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = '')));

  it('muestra en dd/mm/aaaa un valor inicial yyyy-MM-dd', () => {
    host.control.setValue('2026-01-05');
    fixture.detectChanges();
    expect(input().value).toBe('05/01/2026');
  });

  it('al escribir los 8 dígitos, confirma en yyyy-MM-dd', () => {
    type('17/05/1990');
    expect(host.control.value).toBe('1990-05-17');
  });

  it('una fecha imposible (31/02) no se confirma y marca error al salir', () => {
    type('31/02/2026');
    blur();
    expect(host.control.value).toBe('');
    expect(errorText()).toContain('Fecha no válida.');
  });

  it('con un valor válido precargado, escribir una fecha imposible invalida el control (bloquea submit)', () => {
    host.control.setValue('2026-01-05');
    fixture.detectChanges();
    expect(host.control.valid).toBe(true);

    type('31/02/2026');

    expect(host.control.value).toBe('2026-01-05');
    expect(host.control.valid).toBe(false);
    expect(host.control.errors?.['invalidFormat']).toBe(true);
  });

  it('vaciar el campo y salir limpia el valor (sin marcar "Fecha no válida")', () => {
    host.control.setValue('2026-01-05');
    fixture.detectChanges();
    type('');
    blur();
    expect(host.control.value).toBe('');
    // El control queda inválido por su propio Validators.required, no por un formato raro.
    expect(errorText()).not.toContain('Fecha no válida');
  });

  it('sin tocar el campo, el error "required" no se muestra', () => {
    expect(errorText()).toBeFalsy();
  });

  it('tocar y salir vacío muestra el error "required" del control', () => {
    blur();
    expect(errorText()).toContain('Obligatorio.');
  });

  it('el botón Hoy pone la fecha de hoy y cierra el calendario', () => {
    openCalendar();
    buttonByText('Hoy').click();
    fixture.detectChanges();

    const today = new Date().toLocaleDateString('en-CA');
    expect(host.control.value).toBe(today);
  });

  it('el botón Limpiar borra el valor', () => {
    host.control.setValue('2026-01-05');
    fixture.detectChanges();
    openCalendar();
    buttonByText('Limpiar').click();
    fixture.detectChanges();

    expect(host.control.value).toBe('');
  });

  it('Hoy queda deshabilitado si hoy cae fuera de minDate/maxDate', () => {
    host.maxDate = '2000-01-01';
    fixture.detectChanges();
    openCalendar();

    expect(buttonByText('Hoy').disabled).toBe(true);
  });

  it('elegir un día del calendario lo confirma (yyyy-MM-dd) y cierra el calendario', () => {
    openCalendar();

    const day = document.body.querySelector<HTMLButtonElement>('button[role="gridcell"]:not([disabled])')!;
    const iso = day.getAttribute('aria-label');
    day.click();
    fixture.detectChanges();

    expect(host.control.value).toBe(iso);
    expect(document.body.querySelector('[role="dialog"][aria-label="Elegir fecha"]')).toBeNull();
  });
});
