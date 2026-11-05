import { SaleItem } from '../../core/models/sale-item';
import { NewSaleItem } from '../../core/models/sale-item';
import { newSaleItemToReceiptLine, saleItemToReceiptLine } from './receipt-pdf.service';

function saleItem(overrides: Partial<SaleItem> = {}): SaleItem {
  return {
    id: 1,
    description: '',
    design: '',
    line: '',
    material: '',
    technology: '',
    serie: '',
    text: '',
    quantity: '',
    price: 0,
    mount: '',
    mountBrand: '',
    mountModel: '',
    mountColor: '',
    mountQuantity: '',
    mountPrice: 0,
    mountText: '',
    ...overrides,
  };
}

describe('saleItemToReceiptLine', () => {
  it('usa marca + modelo para una montura', () => {
    const line = saleItemToReceiptLine(
      saleItem({ mountBrand: 'Ray-Ban', mountModel: 'RB2132', mountColor: 'Negro', mountQuantity: '1', mountPrice: 250 }),
    );
    expect(line).toEqual({ quantity: '1', description: 'Ray-Ban RB2132', subline: 'Color: Negro', price: 250 });
  });

  it('cae al texto de la montura si no hay marca ni modelo', () => {
    const line = saleItemToReceiptLine(saleItem({ mountQuantity: '2', mountPrice: 120, mountText: 'Armazón genérico' }));
    expect(line.description).toBe('Armazón genérico');
    expect(line.quantity).toBe('2');
    expect(line.subline).toBeNull();
  });

  it('usa la descripción de la resina y las specs como subtítulo', () => {
    const line = saleItemToReceiptLine(
      saleItem({ description: 'Luna progresiva', design: 'Varilux', material: 'Policarbonato', price: 180, quantity: '1' }),
    );
    expect(line.description).toBe('Luna progresiva');
    expect(line.subline).toBe('Varilux / Policarbonato');
  });

  it('sin descripción ni texto no repite las specs como subtítulo', () => {
    const line = saleItemToReceiptLine(saleItem({ design: 'Varilux', material: 'Policarbonato', price: 180 }));
    expect(line.description).toBe('Varilux / Policarbonato');
    expect(line.subline).toBeNull();
  });

  it('usa "Lente" como último recurso', () => {
    const line = saleItemToReceiptLine(saleItem({ price: 50 }));
    expect(line.description).toBe('Lente');
    expect(line.quantity).toBe('1');
  });
});

describe('newSaleItemToReceiptLine', () => {
  it('monturas: marca + modelo, color como subtítulo, siempre 1 unidad', () => {
    const item: NewSaleItem = {
      kind: 'mount',
      mountId: '1',
      mountBrand: 'Oakley',
      mountModel: 'OX8046',
      mountColor: 'Azul',
      mountText: '',
      price: 300,
    };
    expect(newSaleItemToReceiptLine(item)).toEqual({ quantity: '1', description: 'Oakley OX8046', subline: 'Color: Azul', price: 300 });
  });

  it('resinas: descripción con specs como subtítulo', () => {
    const item: NewSaleItem = {
      kind: 'resin',
      resinId: 1,
      description: 'Luna antireflejo',
      design: 'Crizal',
      line: '',
      material: 'CR-39',
      technology: '',
      text: '',
      price: 90,
    };
    expect(newSaleItemToReceiptLine(item)).toEqual({ quantity: '1', description: 'Luna antireflejo', subline: 'Crizal / CR-39', price: 90 });
  });
});
