# L17: Reporte de pagos, ingresos y egresos (E2.8)

**Idea central:** sumar cobros de un período responde una pregunta distinta de sumar ventas. El reporte reúne pagos y egresos, separa pago inicial de abonos posteriores y calcula sus totales a partir del mismo conjunto cargado.

Solo teoría y ejemplos comparados con Flutter/Riverpod, sin ejercicios. Corte: 2026-11-04, `development` en `e456cfe`, confirmado con pull; feature publicada en `1693555`. Incluye el aviso de fallo de egresos y el rango mensual UTC corregidos por Claude; Antigravity aprobó la pantalla. Referencia Flutter: `7d3fa5f240ba705c312d9ab2c5a054f815aab80c`. La documentación espera autorización propia de commit.

## 1. Qué se conserva del reporte Flutter

Flutter tiene `PaymentsReportView` y Notifier `PaymentsReport`. Ofrece Día/Mes/Rango, obtiene pagos y egresos, filtra sucursal en memoria y muestra tres secciones con resúmenes y tablas sin paginación. No incluye una función de exportar CSV en el provider consultado.

Angular usa `/dashboard/settings/payments-report`, presentado como Ingresos y egresos. Mantiene los períodos y las tres secciones; añade KPI Ingresos/Egresos/Neto, badges de importes por método/categoría y un paginador por tabla.

| Flutter | Angular publicado |
|---|---|
| Notifier con `selectedDay`, `selectedMonth` y rango | Inputs del router y `computed search` |
| Consultas de pagos y luego egresos | `Promise.all` para ambas |
| `where`, mapas y `fold` en la vista | Agrupaciones y totales `computed` en `PaymentsReportStore` |
| Filtrar sucursal sobre listas ya cargadas | Filtro enviado en cada consulta Supabase |
| Todas las filas en tablas sin paginador | Tres cortes en memoria de 10 filas |
| Resúmenes repetidos por sección | KPI generales y badges por agrupación |

## 2. Período de consulta y URL

Los inputs `period`, `day`, `month`, `from`, `to` y `branch` reconstruyen la selección. El período por defecto es Día, con la fecha local actual. Mes utiliza los dos selects de L16; Rango utiliza dos C-04 DatePicker. Un ejemplo es `?period=range&from=2026-11-01&to=2026-11-04`.

La consulta convierte los tres modos al contrato `{ from, to, branch }`. Día usa una fecha para ambos extremos; Mes calcula primer/último día con `monthRange`, que construye el final en UTC para no perder un día al pasarlo a ISO; Rango ajusta Hasta si queda antes de Desde. Los límites son incluidos en `gte`/`lte`.

El controlador del segmented se sincroniza con `emitEvent: false` para evitar un ciclo: URL actualiza el control y el control no debe volver a navegar por esa misma actualización. Es equivalente a distinguir un cambio programático de una acción del usuario en un widget Flutter controlado.

Los query parameters preservan la selección al compartir un enlace. Los tres números de página de tablas son signals locales y se reinician a 1 cuando cambia la consulta; no forman parte de la URL.

## 3. Relacionar pagos con la venta correcta

`PaymentRepository.listByDateRange` parte de `pagos`, filtra `fecha_pago` y embebe `ventas!inner(paciente_nombre, folio, sucursal, total_con_descuento, resta)`. La FK `pagos.id_remision` permite identificar la venta, igual que en la consulta por paciente de L12.

`!inner` importa porque al filtrar `ventas.sucursal` se quieren excluir pagos de ventas ajenas a esa sucursal, además de incluir columnas relacionadas. El resultado es `PaymentReportEntry`: datos del pago más paciente, folio, sucursal, total y saldo de la venta. El mapper separa nombres de DB y de TypeScript.

`ExpenseRepository.listByDateRange` consulta `egresos.fecha`, con su categoría y la misma sucursal opcional. Las fechas de pagos y de egresos son las de esos movimientos; no se filtra por `ventas.fecha_actualizada` como en Ventas por vendedor.

La página exige supervisor o superior. Para supervisor con sucursal configurada, `scopedBranch` toma la del perfil y oculta el selector; admin/megadmin puede elegir o ver todas. Esa regla se aplica en el cliente y en los filtros enviados, a diferencia de `dashboard_summary`, que decide el alcance en SQL. No se incorpora una nueva RPC o RLS que imponga por sí sola ese alcance a una solicitud API manipulada. Un perfil supervisor sin sucursal tampoco recibe aquí un bloqueo explícito: queda anotado para revisión del agente de código.

## 4. Un pago inicial no es el total vendido

El store separa `type === 'nueva_venta'` y `type === 'abono_saldo'`. El primer grupo son cobros iniciales al confirmar una venta; el segundo son abonos posteriores. Una nueva venta sin pago inicial no crea un ingreso en esta tabla.

Por ejemplo: una venta de 1,000 cobra inicialmente 200 el día 1 y recibe 300 el día 3. El reporte del día 1 muestra 200 de ingresos por nuevas ventas; el del día 3, 300 por saldos pagados. Ninguno debe registrar 1,000 como dinero cobrado solo porque ese sea el total de la venta.

```ts
// Fórmulas del store, abreviadas.
income = sum(newSales.amount) + sum(balancePayments.amount);
net = income - sum(expenses.amount);
```

Son las fórmulas de esta pantalla, no un cálculo de utilidad contable completo. Los importes excluyen movimientos que la API no haya devuelto. Neto puede ser negativo y la vista lo presenta sin inventar un ingreso que compense la diferencia.

## 5. Agrupaciones derivadas y tres tablas

`newSalesByMethod` y `balancePaymentsByMethod` agrupan por método de pago. `expensesByCategory` agrupa por nombre de categoría o Sin categoría y conserva su color. Todo se deriva de las listas del store mediante `Map`, `computed` y `reduce`, comparable a los `where`/`fold` del original.

Cambiar el período sustituye las listas y recalcula las agrupaciones; no se guardan copias independientes de cada total. Badges y formato de moneda utilizan datos y utilidades compartidas.

Cada tabla corta su lista con `slice` en páginas de 10. Paginar una sección no cambia los KPI del período ni las páginas de las otras dos. Tampoco solicita otra porción al servidor: pagos y egresos se descargaron sin paginación explícita.

Un `select` único no recorre todas las páginas de la API. Si el período supera el máximo de filas configurado, los totales pueden quedar incompletos aunque la UI muestre paginadores. El código no comprueba ese límite; debe verificarse antes del corte.

## 6. Leer correctamente el saldo y los errores

La columna Saldo de la venta viene del encabezado actual. No es una fotografía histórica del saldo justo después de ese pago. Si hay varios abonos de una misma venta, ese saldo puede repetirse en varias filas: sumarlo no calcula la deuda total.

El store consulta en paralelo y descarta respuestas viejas con `lastRequest`. Si fallan pagos muestra error; si fallan egresos conserva los pagos, usa gastos `[]` y muestra «Egresos no disponibles» con Reintentar. Flutter ignoraba ese fallo.

El reporte permanece visible con aviso. Cero egresos no prueba ausencia de gastos y el neto numérico queda incompleto hasta recuperar esa consulta; el aviso no reconstruye datos ausentes.

## 7. Alcance y evidencia

CSV e impresión del reporte quedan fuera. El CSV del plan era una aspiración, sin implementación Flutter consultable. Este PDF es documentación del curso.

Claude reportó 346 tests/build limpio, incluido el aviso de error de egresos. Antigravity aprobó roles, sucursal, períodos y secciones. Codex contrastó el código publicado sin repetir pruebas de navegador; la documentación sigue pendiente de su propio commit.

Fuentes Angular: `features/payments-report/`, `PaymentRepository.listByDateRange`, `ExpenseRepository.listByDateRange`, mappers y `shared/utils/month.ts`. Flutter: [vista](https://github.com/MeloGon/oftal_web/blob/7d3fa5f/lib/features/settings/views/payments_report/payments_report_view.dart) y [Notifier](https://github.com/MeloGon/oftal_web/blob/7d3fa5f/lib/features/settings/viewmodels/payments_report_provider.dart). Estado de implementación/pruebas: `docs/status.md`.

```bash
npm run pdf -- docs/lessons/17-reporte-pagos.md
```

Salida: `docs/informes/17-reporte-pagos.pdf`, ignorada por git y regenerable desde Markdown.
