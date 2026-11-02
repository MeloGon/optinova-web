# L11: Historial de ventas y registro de abonos (E2.5)

**Idea central:** el historial combina búsqueda paginada, detalle de una venta y registro de pagos posteriores. Los filtros viven en la URL; el pago y la actualización del saldo son operaciones distintas coordinadas por el store.

Solo teoría y comparación con Flutter/Riverpod/go_router, sin ejercicios. Revisión documental del 2026-11-01: E2.5 `130d034`, calendario `7b6faf5`, correcciones de fecha `c5080e8` y mensajes reactivos/tabla móvil en `59fa465`. Referencia Flutter `7d3fa5f240ba705c312d9ab2c5a054f815aab80c`, descargada del repo original fuera de este proyecto. La numeración sigue L09 Vender y L10 Egresos por orden de entrega de las lecciones.

## 1. El historial no es todo lo que hace Flutter con ventas

Flutter reúne en `SalesHistory` listado, filtro por campo, pendientes, detalle, abonos y más acciones: finalizar, eliminar, cambiar fecha y generar recibo. Angular recorta E2.5 al listado, filtros, detalle y registro de abonos con S-05 de Claude Design.

No se trasladan automáticamente todos los métodos del Notifier original. Crear ventas pertenece a E2.6; anular, eliminar o editar una venta no se implementan en esta página. El recibo PDF sigue separado incluso después de publicar Vender.

| Flutter | Angular |
|---|---|
| `SalesHistoryView` | `SalesHistoryPage` y HTML |
| `SalesHistory` Notifier con `keepAlive` | `SalesHistoryStore` provisto en la página |
| `getSalesPage` y `hasMore` | `SaleSearch`, `Page<Sale>` y conteo exacto |
| `SalesDetailsDialog` | `SaleDetailsDialog` |
| `RegisterPaymentDialog` | Diálogo propio del mismo propósito |
| Repositorios/datasources de venta y pago | `SaleRepository`, `PaymentRepository` e implementaciones Supabase |

El store Angular tiene duración de pantalla. Navegar fuera destruye sus datos locales, pero volver con la misma URL permite reconstruir la consulta. Es una duración diferente del provider `keepAlive` de Flutter.

## 2. Por qué la migración #8 precede al historial

Los nombres antiguos confundían encabezado y detalle. La migración `20261027200000_ventas_columnas_fk.sql` dejó `ventas` como encabezado (antes `ventas cortas`) y `venta_items` como detalle (antes `ventas`). No son dos tablas nuevas cargadas a mano: son renombres y conversión documentados en el transform.

También limpió columnas a `snake_case`, conservó las fechas textuales como `fecha_legado` y `fecha_venta_legado`, y agregó la FK `ventas.paciente_id`. Se obtiene del ID histórico disponible, no por coincidencia de nombre. No se debe asumir que todos los registros antiguos tenían un ID enlazable.

Las funciones de auditoría se recrearon con nombres de columnas actuales. Un trigger sigue existiendo tras un rename, pero el texto SQL de una función no se reescribe necesariamente para apuntar a las nuevas columnas. Este es un cambio de base de datos, no de interfaz Angular.

E2.5 lee esas tablas e incorpora pagos; las secuencias para crear nuevas ventas llegaron después, con #10 y E2.6. `docs/db-changes.md` registra la aplicación en **dev (optinova-db)**; aquí no se ejecuta ninguna migración sobre **prod (oftal-test-web)**.

## 3. Un buscador, filtros separados y URL

Flutter permite elegir qué campo buscar: paciente, folio, fecha o vendedor. Su Notifier traduce esa opción a una columna y conserva offset y `onlyPending`. Angular sigue S-05: un solo texto busca paciente **o** folio; fecha y sucursal son filtros separados. No ofrece filtro de vendedor en este alcance.

La página recibe `q`, `branch`, `date`, `status`, `page` y `size`. `computed search` arma `SaleSearch`, mientras `text`, `dateControl` y `statusControl` conectan los controles visibles. Como con go_router, la URL expresa el estado navegable; no se añade otro contador de página independiente al store.

Buscar o cambiar filtros reinicia la página. Los efectos sincronizan controles desde la URL usando `emitEvent: false` cuando corresponde; así copiar un estado del router a un control no vuelve a producir innecesariamente la misma navegación. Es similar a no disparar dos veces una búsqueda al sincronizar un controller con el estado de un Notifier.

El botón Limpiar filtros quita texto, sucursal, fecha y página. Conserva el estado seleccionado del segmented: no vuelve necesariamente a Todas. Este detalle sale del `navigate` real, no de interpretar libremente la etiqueta del botón.

## 4. Qué consulta el repositorio

`SupabaseSaleRepository.search` selecciona columnas del encabezado, pide conteo exacto y aplica coincidencia parcial en `paciente_nombre` o `folio`. La fecha usa igualdad en `fecha_actualizada`, no un rango ni la fecha textual de respaldo.

Los resultados se ordenan por fecha y luego ID descendentes, y se limitan con `range`. El mapper transforma columnas españolas en propiedades inglesas y adapta valores nulos. Las fórmulas del resumen trabajan con números del modelo; el ID y el folio conservan su representación textual.

La fecha usada por el historial tiene una consecuencia práctica: al registrar un abono, `applyPayment` actualiza `fecha_actualizada` con la fecha del pago. Por ello filtrar por esa columna no significa siempre filtrar por la fecha original de creación de la venta; el registro de actividad puede moverla de un día a otro.

El store ejecuta en paralelo la lista y `countByStatus`. Este último hace tres consultas con `head: true`: pide conteos sin descargar sus filas. Los tres usan el mismo texto, fecha y sucursal, sin limitarse a la página visible.

## 5. Estados de filtro y estado de una fila

Hay dos clasificaciones relacionadas, pero no idénticas. El segmented usa Todas, Con saldo y Pagadas. La fila usa tres etiquetas: Pagado, Con saldo y Pendiente.

| Regla de fila | Etiqueta |
|---|---|
| `rest <= 0` | Pagado |
| Tiene saldo y `account <= 0` | Pendiente |
| Tiene saldo y ya recibió algún abono | Con saldo |

El filtro Con saldo solicita `resta > 0`, de modo que incluye tanto filas Pendiente como filas Con saldo. El filtro Pagadas usa `resta = 0`. No hay un estado Anulado porque esa función no está implementada.

Esta distinción evita enseñar que el contador Con saldo cuenta solo las filas con la etiqueta de ese mismo nombre. Su propósito es encontrar todas las cuentas por cobrar.

`pageTotal` suma el total con descuento y `pageRest` el saldo de las ventas visibles. Son los importes de esa página, no los de todas las filas que cuenta el segmented. Cambiar de página cambia esas sumas sin cambiar el conjunto general del filtro.

## 6. Abrir el detalle: dos relaciones distintas

Al elegir Ver detalle, la página carga líneas y pagos en paralelo. Las líneas se consultan por `folio_venta`, conservando el criterio de Flutter; los pagos se consultan por `id_remision = sale.id`. El folio visible y el ID del encabezado no son intercambiables.

La consulta por folio merece una precisión histórica: #10 asigna folios nuevos por secuencia, pero no deduplica los antiguos. Que el modelo tenga un ID no significa que `getItems` ya consulte exclusivamente mediante su FK; su método actual recibe el folio.

Si falla la carga de líneas se muestra error y no se abre el detalle. Si falla la carga de pagos, el código pasa una lista vacía al diálogo. Por eso una tabla de pagos vacía no constituye por sí sola una prueba de que nunca se registró un abono.

`SaleDetailsDialog` presenta datos de la venta, productos y pagos, con saldo por cobrar. No muestra Anular ni Imprimir. Si pide registrar un pago, cierra devolviendo `'pay'`; la página abre entonces el formulario de abono. Ese resultado se parece al valor del `Future` que devuelve `showDialog` en Flutter.

## 7. Formulario de abono y reglas concretas

El importe empieza con el saldo completo, redondeado a dos decimales. El usuario puede escribir un pago parcial. El formulario declara monto obligatorio con mínimo 0.01 y fecha obligatoria; además `submit` rechaza un importe que supere el saldo de la venta recibida.

Métodos de pago y moneda vienen de `ConfigService`. Los métodos se presentan como botones con ícono según S-05. C-04 muestra la fecha como `dd/mm/aaaa`, pero entrega ISO al formulario; una fecha mal escrita comunica `invalidFormat` al control y bloquea el envío por `form.invalid`.

La entrada `NewPayment` lleva el ID de venta, importe, fecha, método y `type: 'abono_saldo'`. El usuario registrador se pasa aparte desde la sesión; no se pide por texto libre en el formulario. En L09, el pago que nace con una venta usa `nueva_venta`: son dos momentos distintos del mismo historial de cobros.

El diálogo espera el callback `save`. Si falla conserva los datos y el mensaje; si funciona cierra y la página avisa con toast. No hay que cerrar primero y luego suponer que el servidor aceptó el abono.

## 8. Por qué un computed no observaba el importe

Los textos «Registrar ...» y «la venta quedará Pagada/con saldo» dependen del monto escrito. La primera implementación tenía un `computed` que leía `FormControl.value`, pero ese valor no es un signal. El pago se enviaba correctamente; el aviso podía quedarse con el saldo inicial.

La corrección incorporada en `59fa465` conecta los eventos del control a un signal contador:

```ts
// Esquema del puente del diálogo.
amount.events.subscribe(() => changes.update(n => n + 1));
resultLabel = computed(() => {
  changes();
  return calcularAviso(amount.value);
});
```

El código real usa `takeUntilDestroyed` para cancelar la escucha con el componente. Es comparable a escuchar un controller en Flutter y llamar al mecanismo de actualización de la vista, liberando la suscripción en `dispose`.

Por ejemplo, para saldo 100, escribir 40 debe cambiar el aviso a 60 de saldo; escribir 100 lo cambia a Pagada. El contador no guarda otra copia del importe: solo notifica que el `computed` debe releer el control.

## 9. Registrar un pago y actualizar el encabezado

`SalesHistoryStore.registerPayment` sigue dos operaciones, como el Notifier Flutter. Primero crea la fila del pago. Después suma el importe a `sale.account`, calcula `Math.max(totalWithDiscount - newAccount, 0)` y actualiza cuenta, saldo y fecha de actividad en el encabezado.

Con total 500, cuenta previa 100 y nuevo abono 150, la cuenta pasa a 250 y el saldo a 250. Si el segundo paso funciona, vuelve a cargar la última consulta aplicada para actualizar tabla y contadores.

No es una transacción. Si falla actualizar el encabezado después de insertar el pago, ese pago ya existe; el código no lo revierte ni reintenta automáticamente con una clave de idempotencia. Tampoco evita por sí solo que dos sesiones calculen el saldo desde la misma versión de la venta.

Los pagos unen `perfiles(nombre)` para mostrar quién los registró. La política de lectura del perfil puede impedir obtener el nombre de otra persona, aunque la fila del pago exista. Es una limitación de RLS registrada en `docs/db-changes.md`, no la ausencia de la FK ni una prueba de que el registrador sea anónimo.

## 10. Qué queda fuera y qué se verificó

E2.5 omite CSV y rango de fechas; en Flutter la función de exportación consultada era un stub comentado. Las acciones de finalizar, eliminar, cambiar fecha o imprimir que sí aparecen en otras partes del historial Flutter no forman parte de esta implementación Angular. El recibo queda como entregable posterior a L09, no como una función ya terminada.

Antigravity registró pruebas funcionales de Historial, Egresos y C-04. Claude reportó 146 tests al incorporar el historial, 156 al integrar C-04 y 179 al finalizar E2.6 y sus ajustes compartidos. Se citan como evidencia del estado registrado, sin afirmar una ejecución propia de Codex en esta entrega documental.

Fuentes Flutter `7d3fa5f`: [SalesHistory Notifier](https://github.com/MeloGon/oftal_web/blob/7d3fa5f240ba705c312d9ab2c5a054f815aab80c/lib/features/sales_history/viewmodels/sales_history_provider.dart), [diálogo de pago](https://github.com/MeloGon/oftal_web/blob/7d3fa5f240ba705c312d9ab2c5a054f815aab80c/lib/features/sales_history/views/widgets/register_payment_dialog.dart) y [datasource de ventas](https://github.com/MeloGon/oftal_web/blob/7d3fa5f240ba705c312d9ab2c5a054f815aab80c/lib/core/data/datasources/remote/sale_remote_datasource.dart). Angular: `features/sales-history/`, modelos/contratos de ventas y pagos y sus implementaciones en `core/`.

```bash
npm run pdf -- docs/lessons/11-historial-ventas.md
```

Salida regenerable: `docs/informes/11-historial-ventas.pdf`, ignorada por git. El Markdown es la fuente versionada.
