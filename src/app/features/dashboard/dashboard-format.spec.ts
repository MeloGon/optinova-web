import { fakeActivity } from '../../testing/fake-dashboard.repository';
import {
  ageLabel,
  ageTone,
  describeActivity,
  firstName,
  greeting,
  mountName,
  scopeLabel,
  stockLabel,
  stockTone,
  variation,
} from './dashboard-format';

const money = (n: number) => `S/. ${n}`;

describe('stock bajo', () => {
  it('mountName usa marca y modelo, luego la descripción, y no deja el nombre vacío', () => {
    expect(mountName({ brand: 'OAKLEY', model: 'MOD-014', description: 'x' })).toBe('OAKLEY MOD-014');
    expect(mountName({ brand: 'OAKLEY', model: '', description: '' })).toBe('OAKLEY');
    expect(mountName({ brand: '', model: '', description: ' GENERICO ' })).toBe('GENERICO');
    expect(mountName({ brand: '', model: '', description: '' })).toBe('Armazón sin nombre');
  });

  it('stockLabel y stockTone: la última unidad es lo más urgente', () => {
    expect(stockLabel(1)).toBe('Queda 1');
    expect(stockLabel(2)).toBe('Quedan 2');
    expect(stockTone(1)).toBe('danger');
    expect(stockTone(2)).toBe('warning');
  });
});

describe('antigüedad de la cobranza', () => {
  it('ageLabel dice hoy, singular y plural, y no inventa una edad sin fecha', () => {
    expect(ageLabel(0)).toBe('Hoy');
    expect(ageLabel(1)).toBe('1 día');
    expect(ageLabel(45)).toBe('45 días');
    expect(ageLabel(null)).toBe('Sin fecha');
  });

  it('ageTone usa los mismos cortes que los tramos (7 y 30 días) y trata la falta de fecha como lo más antiguo', () => {
    expect(ageTone(7)).toBe('success');
    expect(ageTone(8)).toBe('warning');
    expect(ageTone(30)).toBe('warning');
    expect(ageTone(31)).toBe('danger');
    expect(ageTone(null)).toBe('danger');
  });
});

describe('variation', () => {
  it('calcula el cambio porcentual y su dirección', () => {
    expect(variation(150, 100)).toEqual({ percent: 50, direction: 'up' });
    expect(variation(75, 100)).toEqual({ percent: 25, direction: 'down' });
    expect(variation(100, 100)).toEqual({ percent: 0, direction: 'flat' });
  });

  it('sin base de comparación (anterior en cero) no inventa un porcentaje', () => {
    expect(variation(500, 0)).toBeNull();
    expect(variation(0, 0)).toBeNull();
  });

  it('un cambio menor a medio punto cuenta como igual, no como subida', () => {
    expect(variation(1002, 1000)).toEqual({ percent: 0, direction: 'flat' });
  });

  it('redondea al entero más cercano', () => {
    expect(variation(1129, 1000)).toEqual({ percent: 13, direction: 'up' });
  });
});

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
