import { Injectable, inject } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import robotoFonts from 'pdfmake/build/fonts/Roboto';
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { ConfigService } from '../../core/config/config.service';
import { Sale } from '../../core/models/sale';
import { NewSaleItem, SaleItem } from '../../core/models/sale-item';
import { formatMoney } from '../pipes/money.pipe';

pdfMake.addFontContainer(robotoFonts);

/** 80mm en pt (igual que `PdfPageFormat.roll80` de Flutter, ancho real del rollo térmico). */
const PAGE_WIDTH = 226.77;
const MARGIN_X = 10;
const MARGIN_Y = 4;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

/** Una fila del ticket: ya resuelta a texto, sin importar si viene de una resina o un armazón. */
export interface ReceiptLine {
  quantity: string;
  description: string;
  subline: string | null;
  price: number;
}

/**
 * = `_itemDescription`/`_itemSubline` de Flutter, para una fila ya guardada en `venta_items`
 * (montura y lente aplanados en la misma fila: hay que adivinar cuál es con los campos presentes).
 */
export function saleItemToReceiptLine(item: SaleItem): ReceiptLine {
  const isMount = item.mountPrice > 0 || !!item.mountQuantity;
  if (isMount) {
    const brandModel = [item.mountBrand, item.mountModel].filter(Boolean).join(' ').trim();
    return {
      quantity: item.mountQuantity || '1',
      description: brandModel || item.mountText || item.mount || 'Montura',
      subline: item.mountColor ? `Color: ${item.mountColor}` : null,
      price: item.mountPrice,
    };
  }

  const specs = [item.design, item.line, item.material, item.technology].filter(Boolean).join(' / ');
  const usedTextOrDescription = !!(item.description || item.text);
  return {
    quantity: item.quantity || '1',
    description: item.description || item.text || specs || 'Lente',
    subline: usedTextOrDescription && specs ? specs : null,
    price: item.price,
  };
}

/**
 * Misma idea, pero para una línea del carrito recién creada (`NewSaleItem`): no hace falta
 * adivinar resina/armazón, ya viene marcado (`kind`), así que no repite la lógica de Flutter.
 */
export function newSaleItemToReceiptLine(item: NewSaleItem): ReceiptLine {
  if (item.kind === 'mount') {
    const brandModel = `${item.mountBrand} ${item.mountModel}`.trim();
    return {
      quantity: '1',
      description: brandModel || item.mountText || 'Montura',
      subline: item.mountColor ? `Color: ${item.mountColor}` : null,
      price: item.price,
    };
  }

  const specs = [item.design, item.line, item.material, item.technology].filter(Boolean).join(' / ');
  const usedTextOrDescription = !!(item.description || item.text);
  return {
    quantity: '1',
    description: item.description || item.text || specs || 'Lente',
    subline: usedTextOrDescription && specs ? specs : null,
    price: item.price,
  };
}

function divider(thickness = 0.8): Content {
  return {
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: thickness, lineColor: 'black' }],
    margin: [0, 3, 0, 3],
  };
}

function doubleDivider(): Content {
  return { stack: [divider(), { text: '', fontSize: 1 }, divider()] };
}

/** `yyyy-MM-dd` → `dd/MM/yyyy`; si no calza con ese formato, lo deja igual (= `_formatDate` de Flutter). */
function toDisplayDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d && y.length === 4 ? `${d}/${m}/${y}` : iso;
}

function financialBox(label: string, value: string, strong = false): Content {
  return {
    table: {
      widths: ['*'],
      body: [
        [
          {
            stack: [
              { text: label, bold: true, fontSize: 6.5, alignment: 'center' },
              { text: value, bold: true, fontSize: 8.5, alignment: 'center', margin: [0, 1, 0, 0] },
            ],
          },
        ],
      ],
    },
    layout: {
      hLineWidth: () => (strong ? 1.2 : 0.8),
      vLineWidth: () => (strong ? 1.2 : 0.8),
      hLineColor: () => 'black',
      vLineColor: () => 'black',
      paddingLeft: () => 2,
      paddingRight: () => 2,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
  };
}

/**
 * Recibo de venta en PDF (= `ReceiptPdfService` de Flutter: ticket térmico de 80mm, con pdfmake en
 * vez de `package:pdf`). Dos lugares lo llaman, igual que en Flutter: al crear una venta (Vender)
 * y al reimprimir desde Historial de ventas. Simplificación consciente: cada línea del carrito es
 * siempre 1 unidad (como ya se guarda en `venta_items`), así que el ticket no agrupa cantidades
 * repetidas en una sola fila como hacía Flutter.
 */
@Injectable({ providedIn: 'root' })
export class ReceiptPdfService {
  private readonly config = inject(ConfigService).config;

  async print(sale: Sale, lines: ReceiptLine[]): Promise<void> {
    const currency = this.config().currency;
    const branch = this.config().branches.find((b) => b.value === sale.branch);
    const money = (amount: number) => formatMoney(amount, currency);
    const hasDiscount = sale.discount > 0;
    const hasPendingBalance = sale.rest > 0;

    const content: Content[] = [
      // 1. Encabezado: logo si la sucursal tiene uno configurado (Fase 4b), si no el nombre en texto.
      branch?.logoUrl
        ? { image: branch.logoUrl, width: 140, alignment: 'center', margin: [0, 0, 0, 2] }
        : { text: sale.branch.toUpperCase(), bold: true, fontSize: 13, alignment: 'center' },
      ...(branch?.phone
        ? [{ text: `Tel: ${branch.phone}`, fontSize: 7.5, alignment: 'center', margin: [0, 1, 0, 0] } satisfies Content]
        : []),

      // 2. Folio
      doubleDivider(),
      {
        columns: [
          { text: 'RECIBO DE VENTA', bold: true, fontSize: 8.5 },
          { text: `FOLIO: #${sale.folio || '—'}`, bold: true, fontSize: 9, alignment: 'right' },
        ],
      },
      doubleDivider(),

      // 3. Metadatos
      {
        columns: [
          { text: `Fecha: ${toDisplayDate(sale.date)}`, fontSize: 8 },
          { text: `Atención: ${sale.sellerName || '—'}`, fontSize: 8, alignment: 'right' },
        ],
        margin: [0, 0, 0, 4],
      },

      // 4. Paciente
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: [
                  { text: 'PACIENTE:', bold: true, fontSize: 6.5 },
                  { text: sale.patientName.toUpperCase(), bold: true, fontSize: 9, margin: [0, 1, 0, 0] },
                ],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0.8,
          vLineWidth: () => 0.8,
          hLineColor: () => 'black',
          vLineColor: () => 'black',
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
        margin: [0, 0, 0, 4],
      },

      // 5-6. Tabla de productos
      divider(),
      {
        table: {
          widths: [22, '*', 'auto'],
          body: [
            [
              { text: 'CANT', bold: true, fontSize: 7 },
              { text: 'DESCRIPCIÓN', bold: true, fontSize: 7 },
              { text: 'TOTAL', bold: true, fontSize: 7, alignment: 'right' },
            ] satisfies TableCell[],
            ...lines.map(
              (line): TableCell[] => [
                { text: line.quantity, bold: true, fontSize: 8 },
                {
                  stack: [
                    { text: line.description, bold: true, fontSize: 8 },
                    ...(line.subline
                      ? [{ text: line.subline, fontSize: 7, margin: [0, 1, 0, 0] as [number, number, number, number] }]
                      : []),
                  ] satisfies Content[],
                },
                { text: money(line.price), bold: true, fontSize: 8, alignment: 'right' },
              ],
            ),
          ],
        },
        layout: 'noBorders',
        margin: [0, 2, 0, 0],
      },
      divider(),

      // 7. Subtotal/Descuento, solo si hay descuento
      ...(hasDiscount
        ? ([
            {
              columns: [
                { text: 'Subtotal:', fontSize: 7.5 },
                { text: money(sale.total), fontSize: 7.5, alignment: 'right' },
              ],
            },
            {
              columns: [
                { text: 'Descuento:', bold: true, fontSize: 7.5 },
                { text: `-${money(sale.discount)}`, bold: true, fontSize: 7.5, alignment: 'right' },
              ],
            },
          ] satisfies Content[])
        : []),

      // 8. Cajas financieras
      {
        columns: [
          financialBox('TOTAL VENTA', money(sale.totalWithDiscount)),
          financialBox('A CUENTA', money(sale.account)),
          financialBox('SALDO RESTA', money(sale.rest), true),
        ],
        columnGap: 4,
        margin: [0, 4, 0, 4],
      },

      // 9. Destaque de saldo
      divider(1),
      {
        text: hasPendingBalance ? `*** SALDO PENDIENTE: ${money(sale.rest)} ***` : '*** TOTALMENTE CANCELADO ***',
        bold: true,
        fontSize: 8.5,
        alignment: 'center',
        margin: [0, 3, 0, 3],
      },
      divider(1),

      // 10. Aviso de retiro
      {
        text: 'IMPORTANTE: Presentar este recibo original para el retiro de sus lentes.',
        italics: true,
        fontSize: 6.5,
        alignment: 'center',
        margin: [0, 4, 0, 4],
      },

      // 11. QR con el folio (pedido del dueño en vez del código de barras de Flutter)
      ...(sale.folio
        ? ([
            { qr: sale.folio, fit: 110, alignment: 'center' },
            { text: `* ${sale.folio} *`, bold: true, fontSize: 7.5, alignment: 'center', margin: [0, 2, 0, 0] },
          ] satisfies Content[])
        : []),

      // 12. Pie
      { text: '¡Gracias por su preferencia!', bold: true, fontSize: 8, alignment: 'center', margin: [0, 6, 0, 0] },
      { text: toDisplayDate(sale.date), fontSize: 6.5, alignment: 'center' },
    ];

    const docDefinition: TDocumentDefinitions = {
      pageSize: { width: PAGE_WIDTH, height: 'auto' },
      pageMargins: [MARGIN_X, MARGIN_Y, MARGIN_X, MARGIN_Y],
      defaultStyle: { font: 'Roboto', fontSize: 8, color: 'black' },
      content,
    };

    await pdfMake.createPdf(docDefinition).download(`recibo_${sale.folio || 'venta'}.pdf`);
  }
}
