# L16: Ventas por vendedor, agrupaciones y navegación (E2.8)

**Idea central:** un reporte puede resumir un mes en una fila por vendedor y abrir el detalle solo cuando se necesita. El store conserva ventas y deriva los agregados; la URL permite reconstruir la selección sin transportar listas entre páginas.

Teoría comparada con Flutter/Riverpod, sin ejercicios. Corte 2026-11-04: feature `d99ced3`, sobre `development` en `e456cfe` tras pull. Antigravity aprobó resumen, comisiones y detalle; Claude reportó tests/build. El flujo folio/abono no tiene test de componente. Flutter: `7d3fa5f240ba705c312d9ab2c5a054f815aab80c`.

## 1. El reporte existe en Flutter, con otra organización

`SalesBySellerView` agrupa ventas y dibuja un `SellerSection` por persona, con encabezado, métricas y tabla. Su Notifier carga el mes, permite activar/desactivar vendedores y genera un reporte PDF real. También ofrece `CommissionsDialog`.

Angular usa una tabla de agregados en `/dashboard/settings/sales-by-seller`, ordenada por total vendido descendente. El nombre abre la página `/dashboard/settings/sales-by-seller/:name`. No se copia el bloque completo de cada vendedor en la pantalla principal.

| Flutter | Angular publicado |
|---|---|
| Notifier `SalesBySeller` | `SalesBySellerStore`, signals privados y lecturas `computed` |
| Secciones repetidas por vendedor | Una tabla resumen y página de detalle propia |
| Mes y selección de vendedores en estado | Mes/sucursal en URL; todos los vendedores agrupados |
| `fold` y mapas para calcular sumas | `Map<string, SellerAggregate>` y `reduce` |
| Comisiones con acción Calcular | FormControl conectado a signal y cálculo automático |
| Generación PDF implementada | Impresión del reporte pendiente en Angular |

## 2. Fuente de datos y significado del mes

`SaleRepository.listByMonth` recibe `month` como `yyyy-MM` y sucursal opcional. Usa `monthRange` compartido y consulta `ventas.fecha_actualizada` con límites incluidos. El último día se construye con `Date.UTC` antes de pasarlo a ISO: corrige el día perdido en husos positivos al convertir una medianoche local. La fecha de la venta cambia al registrar un abono (L11); el reporte no garantiza agrupar por creación original.

La consulta devuelve una lista, no un `Page<Sale>`. `SalesBySellerStore.load` guarda esas ventas y usa `lastRequest` para descartar respuestas antiguas. Las agrupaciones derivan del mismo conjunto recibido; no hay una consulta por cada vendedor en la tabla resumen.

Aquí aparece una diferencia con los inventarios de L13/L14: esos piden ventanas `range`; este reporte pide el mes sin paginar en servidor. Un mes acota las fechas, pero no garantiza un número pequeño de ventas. No hay un bucle que descargue todas las páginas de la API; los límites configurados de respuesta pueden truncar la lista y, con ella, los totales. Debe verificarse antes del corte.

## 3. Agrupar nombres conserva una limitación de identidad

`sellerKey` recorta el nombre, elimina espacios vacíos y normaliza mayúsculas/minúsculas por palabra; si está vacío usa Sin vendedor. MARIA LOPEZ y maria lopez terminan en el mismo grupo. El original Flutter ya tenía una normalización por título para el reporte; Angular la comparte entre resumen y detalle en un módulo propio.

Cada grupo acumula número de ventas, total con descuento, abonado y saldo. Después se ordena por total vendido. Los KPI muestran total vendido, saldo pendiente y vendedores con ventas del conjunto recibido, no solo de la página visible del detalle.

No se añadió una FK a vendedores. Dos personas distintas con el mismo nombre pueden mezclarse, y cambios de nombre o acentos pueden producir grupos separados. Tampoco se identifica al vendedor con `ventas.creado_por`: ese campo es quien registró la operación, distinto de `autor_nombre`, según #12.

## 4. Mes/año nativos y el valor que se veía como Enero

El dueño pidió reemplazar el input de mes por dos selects: Mes y Año. `shared/utils/month.ts` comparte nombres de meses, año actual y diez anteriores, etiqueta y límites del mes. La sucursal viene de `ConfigService`. Los cambios escriben `?month=2026-11&branch=...`.

En una prueba, el dato pedía noviembre pero el select mostraba Enero. `[value]` del select se escribía antes de que las opciones de `@for` estuvieran disponibles. La corrección usa `[selected]` en cada opción, comparando contra el valor actual. Es comparable a asegurar que el valor de un Dropdown de Flutter coincida con una de sus opciones, pero aquí también interviene el momento en que se crean nodos del DOM.

La utilidad `toMonth` valida la forma del texto con una expresión regular; no comprueba exhaustivamente que un mes escrito a mano en la URL esté entre 01 y 12. Los controles normales ofrecen valores válidos, pero eso no equivale a validar cualquier enlace externo.

## 5. Una página para el vendedor y un diálogo para la venta

El nombre del vendedor se utiliza como parámetro de ruta, acompañado de mes, sucursal, página y tamaño en query parameters. Al abrir el enlace directamente, `SellerSalesStore` vuelve a pedir el mes y filtra por `sellerKey`. No depende de haber pasado antes por la tabla resumen.

La página reemplazó un diálogo de vendedor que se había considerado incómodo con muchas filas y en móvil. Su C-08 Paginator corta la lista mediante `slice` en memoria. Aunque la URL tiene página y tamaño reales, la consulta de datos no pagina por vendedor en PostgreSQL: vuelve a traer el mes en cada `load`, incluso cuando el efecto se activa por cambio de página.

El folio sí representa una venta puntual y abre `SaleDetailsDialog`. Se reutilizan `getItems(folio)` y `listBySale(sale.id)`; folio e ID conservan significados distintos. Si el detalle solicita Registrar pago, se abre `RegisterPaymentDialog` y guarda mediante `SalePaymentService`. Tras el éxito recarga el reporte, sin duplicar la interfaz de Historial de ventas.

El servicio compartido sigue insertando pago y actualizando saldo en dos escrituras sin transacción única. Reutilizarlo evita copiar reglas, pero no elimina esa limitación.

## 6. Comisiones como simulación derivada

El diálogo recibe los agregados y un porcentaje. Usa `toSignal(pctControl.valueChanges)` para conectar Reactive Forms con un `computed`: `FormControl.value` por sí solo no es una dependencia de signals.

```ts
// Fórmula explicativa, sin persistencia.
commission = seller.total * (percentage / 100);
```

Con total 1,000 y 5%, muestra 50; cambiar el porcentaje actualiza filas y total de comisiones. No se guarda, no crea egresos ni significa que ya se haya pagado a un vendedor. El control tiene mínimo 0.01, pero no declara máximo 100; la tabla de resultados es una simulación de los valores ingresados.

## 7. C-07: por qué no bastaba text-right en el encabezado

El dueño vio títulos de importes a la izquierda y sus números a la derecha. El estilo compartido `[&_th]:text-left` producía una regla sobre clase más elemento, más específica que `.text-right` aplicada al `th`. Cambiar el orden de clases del HTML no resolvía esa prioridad.

La regla por defecto pasó a `[&_th:not(.text-right):not(.text-center)]:text-left`. Así excluye las celdas que ya declaran su propia alineación. El arreglo beneficia a todas las tablas C-07, incluidos inventarios, Egresos e Historial. Desde Flutter, la comparación útil es definir una alineación por defecto que respete la decisión de cada columna; en CSS además hay que entender qué selector gana.

## 8. Alcance, evidencia y fuentes

La ruta principal y el detalle exigen admin o superior. Se omiten el filtro para desactivar vendedores y el PDF de reporte que sí existen en Flutter. El PDF de esta lección no implementa esa impresión de negocio.

Claude reportó 346 tests/build limpio. Antigravity aprobó resumen, comisiones, detalle y venta, y señaló el fallo de fecha luego corregido con UTC. C-07 está en `55b74fe`. Codex no repitió esas pruebas.

Fuentes Angular: `features/sales-by-seller/`, `seller-key.ts`, `shared/utils/month.ts`, `SaleRepository.listByMonth` y C-07. Flutter: [vista](https://github.com/MeloGon/oftal_web/blob/7d3fa5f/lib/features/settings/views/sales_by_seller/sales_by_seller_view.dart), [Notifier y PDF](https://github.com/MeloGon/oftal_web/blob/7d3fa5f/lib/features/settings/viewmodels/sales_by_seller_provider.dart) y [comisiones](https://github.com/MeloGon/oftal_web/blob/7d3fa5f/lib/features/settings/views/sales_by_seller/widgets/commissions_dialog.dart).

```bash
npm run pdf -- docs/lessons/16-ventas-por-vendedor.md
```

Salida: `docs/informes/16-ventas-por-vendedor.pdf`, ignorada por git y regenerable.
