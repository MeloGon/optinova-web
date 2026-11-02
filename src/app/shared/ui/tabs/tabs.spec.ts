import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Tabs, TabOption } from './tabs';

@Component({
  selector: 'app-tabs-host',
  imports: [Tabs],
  template: `<onv-tabs [tabs]="tabs" [active]="active()" (activeChange)="active.set($event)" />`,
})
class HostComponent {
  readonly active = signal('reviews');
  readonly tabs: TabOption[] = [
    { value: 'reviews', label: 'Revisiones', count: 1 },
    { value: 'sales', label: 'Ventas', count: 2 },
    { value: 'payments', label: 'Pagos' },
  ];
}

describe('Tabs', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const root = () => fixture.nativeElement as HTMLElement;
  const buttons = () => Array.from(root().querySelectorAll<HTMLButtonElement>('button[role=tab]'));
  const pressKey = (el: HTMLElement, key: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('marca aria-selected en la pestaña activa y apunta aria-controls a su panel', () => {
    const [reviews, sales] = buttons();
    expect(reviews.getAttribute('aria-selected')).toBe('true');
    expect(reviews.getAttribute('aria-controls')).toBe('tabpanel-reviews');
    expect(sales.getAttribute('aria-selected')).toBe('false');
  });

  it('click en otra pestaña la activa', () => {
    buttons()[1].click();
    expect(host.active()).toBe('sales');
  });

  it('flecha derecha pasa a la siguiente (cíclico) y mueve el foco', () => {
    pressKey(buttons()[0], 'ArrowRight');
    fixture.detectChanges();
    expect(host.active()).toBe('sales');

    pressKey(buttons()[2], 'ArrowRight');
    fixture.detectChanges();
    expect(host.active()).toBe('reviews'); // de la última vuelve a la primera
  });

  it('flecha izquierda pasa a la anterior (cíclico)', () => {
    pressKey(buttons()[0], 'ArrowLeft');
    fixture.detectChanges();
    expect(host.active()).toBe('payments'); // de la primera vuelve a la última
  });

  it('Inicio/Fin van a la primera/última pestaña', () => {
    pressKey(buttons()[0], 'End');
    fixture.detectChanges();
    expect(host.active()).toBe('payments');

    pressKey(buttons()[2], 'Home');
    fixture.detectChanges();
    expect(host.active()).toBe('reviews');
  });

  it('otras teclas no cambian nada', () => {
    pressKey(buttons()[0], 'Tab');
    expect(host.active()).toBe('reviews');
  });
});
