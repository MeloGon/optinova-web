import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BarChart, niceMax } from './bar-chart';
import { DonutChart, sliceColor } from './donut-chart';
import { Sparkline } from './sparkline';

@Component({
  imports: [BarChart, DonutChart, Sparkline],
  template: `
    <onv-bar-chart [data]="bars" ariaLabel="Ventas por día" [format]="fmt" />
    <onv-donut-chart [slices]="slices" ariaLabel="Pagos por método" [format]="fmt" />
    <onv-sparkline [values]="values" ariaLabel="Tendencia" />
  `,
})
class Host {
  bars = [
    { label: 'lun', value: 0 },
    { label: 'mar', value: 50 },
    { label: 'Hoy', value: 100 },
  ];
  slices = [
    { label: 'Efectivo', value: 75 },
    { label: 'Tarjeta', value: 25 },
    { label: 'Vacío', value: 0 },
  ];
  values = [0, 10, 5, 20];
  fmt = (n: number) => `S/. ${n}`;
}

describe('niceMax', () => {
  it('sube el tope a 1, 2, 5 o 10 por una potencia de diez', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(3)).toBe(5);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(120)).toBe(200);
    expect(niceMax(4422)).toBe(5000);
  });
});

describe('gráficas SVG', () => {
  const render = () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('barras: una por dato, una barra en 0 no ocupa alto y todas son legibles sin gráfica', () => {
    const el = render();
    const rects = Array.from(el.querySelectorAll('onv-bar-chart rect'));

    expect(rects).toHaveLength(3);
    expect(rects[0].getAttribute('height')).toBe('0');
    expect(Number(rects[2].getAttribute('height'))).toBeGreaterThan(Number(rects[1].getAttribute('height')));
    // tabla accesible con los mismos valores
    expect(el.querySelector('onv-bar-chart table.sr-only')?.textContent).toContain('S/. 100');
  });

  it('barras: la última etiqueta ("Hoy") siempre se muestra', () => {
    const labels = Array.from(render().querySelectorAll('onv-bar-chart svg text')).map((t) => t.textContent?.trim());
    expect(labels).toContain('Hoy');
  });

  it('dona: omite porciones en 0 y reparte los porcentajes', () => {
    const el = render();
    const legend = el.querySelector('onv-donut-chart ul')!.textContent!;

    expect(legend).toContain('Efectivo');
    expect(legend).toContain('75%');
    expect(legend).toContain('25%');
    expect(legend).not.toContain('Vacío');
  });

  it('dona: el total va al centro con el formato recibido', () => {
    expect(render().querySelector('onv-donut-chart svg')?.textContent).toContain('S/. 100');
  });

  it('sliceColor recorre los 6 colores de serie y vuelve a empezar', () => {
    expect(sliceColor(0)).toBe('var(--color-chart-1)');
    expect(sliceColor(5)).toBe('var(--color-chart-6)');
    expect(sliceColor(6)).toBe('var(--color-chart-1)');
  });

  it('mini gráfica: dibuja la línea y tiene descripción', () => {
    const svg = render().querySelector('onv-sparkline svg')!;
    expect(svg.getAttribute('aria-label')).toBe('Tendencia');
    expect(svg.querySelectorAll('path')).toHaveLength(2); // área + línea
  });

  it('mini gráfica: con un solo punto no hay tendencia y no dibuja nada', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.values = [5];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('onv-sparkline svg')).toBeNull();
  });
});
