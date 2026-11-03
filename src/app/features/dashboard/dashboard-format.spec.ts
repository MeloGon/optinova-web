import { fakeActivity } from '../../testing/fake-dashboard.repository';
import { describeActivity, firstName, greeting, scopeLabel } from './dashboard-format';

const money = (n: number) => `S/. ${n}`;

describe('greeting', () => {
  // 15:00 UTC = 10:00 en Lima (UTC−5)
  it('usa la hora de la zona de la empresa, no la del navegador', () => {
    expect(greeting(new Date('2026-11-02T15:00:00Z'), 'America/Lima')).toBe('Buenos días');
    expect(greeting(new Date('2026-11-02T18:00:00Z'), 'America/Lima')).toBe('Buenas tardes');
    expect(greeting(new Date('2026-11-03T01:30:00Z'), 'America/Lima')).toBe('Buenas noches');
  });

  it('la madrugada es noche, no mañana', () => {
    expect(greeting(new Date('2026-11-02T05:00:00Z'), 'America/Lima')).toBe('Buenas noches'); // 00:00
    expect(greeting(new Date('2026-11-02T09:59:00Z'), 'America/Lima')).toBe('Buenas noches'); // 04:59
    expect(greeting(new Date('2026-11-02T10:00:00Z'), 'America/Lima')).toBe('Buenos días'); // 05:00
  });
});

describe('firstName', () => {
  it('toma la primera palabra y tolera nombres vacíos', () => {
    expect(firstName('Vendedor Prueba')).toBe('Vendedor');
    expect(firstName('  Ana  ')).toBe('Ana');
    expect(firstName(undefined)).toBe('');
  });
});

describe('scopeLabel', () => {
  it('explica el alcance de cada rol', () => {
    expect(scopeLabel('mine', 'MEDILENT')).toBe('Tus ventas y las de tu cuenta');
    expect(scopeLabel('branch', 'MEDILENT')).toBe('Sucursal MEDILENT');
    expect(scopeLabel('all', null)).toBe('Todas las sucursales');
    expect(scopeLabel('all', 'OFTALVISION')).toBe('Sucursal OFTALVISION');
  });
});

describe('describeActivity', () => {
  it('en una venta dice quién la registró y a nombre de qué vendedor', () => {
    const entry = { ...fakeActivity('create_sale'), detail: { folio: '100058', vendedor: 'BETO', creado_por_nombre: 'Ana' } };
    expect(describeActivity(entry, money)).toBe('Ana registró la venta 100058 (vendedor: BETO)');
  });

  it('en ventas históricas, sin nombre de quien la registró, cae al correo', () => {
    const entry = { ...fakeActivity('create_sale'), detail: { folio: '7' } };
    expect(describeActivity(entry, money)).toBe('vendedor@optinova.test registró la venta 7');
  });

  it('un pago muestra el monto con el formato de moneda de la empresa', () => {
    const entry = { ...fakeActivity('register_payment'), detail: { monto: 400 } };
    expect(describeActivity(entry, money)).toContain('de S/. 400');
  });

  it('una acción desconocida no rompe: muestra la acción tal cual', () => {
    expect(describeActivity(fakeActivity('algo_nuevo'), money)).toBe('vendedor@optinova.test · algo_nuevo');
  });
});
