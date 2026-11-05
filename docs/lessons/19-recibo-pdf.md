# L19: Recibo PDF térmico de una venta

**Idea central:** una vista previa en pantalla y un archivo para imprimir son dos representaciones de la misma venta. El recibo usa un servicio común para generarse al vender o desde el historial.

Solo teoría, comparada con Flutter. Implementación publicada en `c5d5950`; referencia Flutter `7d3fa5f`. No es el PDF de esta lección: es el ticket de negocio de una venta.

## 1. Dos tecnologías para un mismo rollo

Flutter usa `ReceiptPdfService` con `package:pdf` y `PdfPageFormat.roll80`. Angular usa `ReceiptPdfService` con pdfmake y una definición declarativa de contenido. El ancho es 226,77 puntos, equivalente a 80 mm; la altura es automática para acompañar la cantidad de líneas.

| Flutter | Angular |
|---|---|
| `pw.Document`, `pw.Widget` | `TDocumentDefinitions`, objetos `content` |
| `PdfPageFormat.roll80` | ancho 226,77 pt y altura automática |
| Código de barras Code 128 | QR con el folio, por pedido del dueño |
| Generación desde venta e historial | servicio compartido llamado desde ambos flujos |

El PDF se descarga con un nombre basado en el folio. Descargar un archivo no demuestra que la impresora tenga el tamaño, escala o papel adecuados.

## 2. Convertir productos antes de dibujar

`ReceiptLine` representa cantidad, descripción, sublínea y precio. `newSaleItemToReceiptLine` transforma una línea nueva del carrito, que ya indica `kind`; `saleItemToReceiptLine` interpreta una línea guardada, donde montura y lente comparten campos. Separar conversión y composición permite usar la misma plantilla con ambas fuentes.

El carrito Angular guarda cada línea nueva como una unidad: el recibo no agrupa líneas repetidas como el original Flutter. Para líneas históricas se usa la cantidad guardada. La descripción elige campos disponibles y puede incluir una sublínea de características o color.

## 3. Composición y valores

La definición contiene encabezado, folio, fecha, paciente, tabla de productos, descuento si existe, total, a cuenta, saldo y aviso de retiro. Si hay saldo se destaca; si no, indica venta cancelada. El QR contiene el folio cuando existe: representa ese texto, no una URL ni una validación automática de la venta.

La moneda sale de `ConfigService`. La sucursal puede aportar `logoUrl` y `phone`; si no hay logo, se muestra el nombre y si no hay teléfono se omite. Estos campos son opcionales y la configuración actual aún no ofrece pantalla de administración para cargarlos por sucursal.

## 4. Por qué un servicio compartido

En Riverpod se puede invocar un servicio de impresión desde el notifier; en Angular el servicio `providedIn: 'root'` se inyecta en los flujos que lo necesitan. Así historial y venta comparten formato sin que cada pantalla copie tablas, reglas de saldo y QR.

El ticket refleja los datos recibidos en el momento de generar el documento; no es una fotografía independiente guardada en la base de datos. Las reglas de cálculo y guardado de la venta se explican en L09 y L11.

## 5. Fuentes y comprobación

Fuentes: `shared/services/receipt-pdf.service.ts`, sus pruebas y llamadas desde Vender/Historial. Flutter: [servicio de recibos](https://github.com/MeloGon/oftal_web/blob/7d3fa5f/lib/shared/services/receipt_pdf_service.dart). El commit y la aprobación manual están registrados en `docs/status.md`; esta revisión no ejecuta una impresión nueva.

```bash
npm run pdf -- docs/lessons/19-recibo-pdf.md
```
