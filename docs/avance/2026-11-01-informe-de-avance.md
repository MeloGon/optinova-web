# Informe de avance: Optinova Web al 2026-11-01

Fecha de corte: **1 de noviembre de 2026**. Rama `development`; implementación revisada hasta `59fa465`. Fuentes: historial Git, `docs/status.md`, `docs/migration-plan.md`, `docs/db-changes.md` y lecciones L09–L11. Este informe describe el estado actual; los informes del 14 y 26 de octubre conservan su valor histórico.

## 1. Estado del sistema

La aplicación Angular tiene infraestructura, tema y layouts, autenticación, búsqueda y alta de pacientes, revisiones, egresos, historial de ventas con abonos y nueva venta en tres pasos. Flutter sigue siendo la aplicación de producción: esta entrega no cambia ambientes ni realiza el corte.

E2.6 Vender está publicado y aprobado por el dueño. Su alcance reúne selección de paciente, catálogo paginado, carrito, precios, descuento accesible por rol, cuenta inicial y confirmación con vista previa. El recibo térmico PDF y la autorización P-04 completa siguen como entregables separados.

## 2. Avance desde el informe del 26 de octubre

| Commit | Entregable y comportamiento |
|---|---|
| `9ef2111` | E2.3b: medidas, FK a paciente, diálogos y P-05 Graduación |
| `2cbea08` | EJE válido al guardar, errores reactivos y detalle completo de medidas |
| `174f60e` | L08 Revisiones y medidas; documentación comparada con Flutter |
| `e0034f0` | E2.4: listado, alta, edición, borrado de egresos y categorías |
| `7b6faf5` | C-04 Date picker propio, captura de fechas y acciones Hoy/Limpiar |
| `130d034` | E2.5: historial, filtros, estados, detalle y registrar abonos |
| `d180484` | Consolidación documental de E2.4, C-04 y E2.5 |
| `c5080e8` | Fecha mal escrita bloqueada, fechas de pagos formateadas y limpiar filtros |
| `59fa465` | E2.6: nueva venta en tres pasos, stock por cantidad, permiso de descuento y vista previa |

El catálogo de Vender pide Buscar explícitamente y entrega diez productos por página. Las resinas se buscan por descripción o texto. Cada unidad agregada es una línea del carrito; el indicador de cantidad agrupa visualmente esas líneas.

Al confirmar se inserta primero el encabezado y después sus detalles, para respetar la FK de dev. Luego se descuenta el stock agrupado por armazón y se registra el pago inicial si lo hay. La vista previa permite revisar antes de escribir; la confirmación posterior devuelve folio, total y saldo y ofrece ir al historial.

## 3. Base de datos y ambientes

Hay **11 archivos de migración**, contando baseline y cambios #1–#10, y **8 documentos de transform**, #3–#10. Las conversiones se aplican por entregable y quedan registradas para repetirlas durante el corte.

Desde el informe anterior se añadieron #7 (revisiones y FK de paciente), #8 (encabezados `ventas`, detalles `venta_items` y columnas limpias), #9 (catálogo de armazones/resinas/vendedores) y #10 (secuencias de ID/folio de venta y de detalles).

Los cambios nuevos se documentan como aplicados en **dev (optinova-db)**. **Prod (oftal-test-web)** conserva el esquema de Flutter hasta el corte autorizado. Este informe no consulta pacientes, cambia datos ni vuelve a ejecutar migraciones.

## 4. Curso y documentos para Drive

La biblioteca contiene **17 lecciones**: doce por entregable, 00–11, y cinco de fundamentos, F00–F03 y F07. F04–F06 siguen pendientes y no se incluyen como documentos existentes.

Las nuevas son L09 Vender, L10 Egresos y L11 Historial de ventas, preparadas el 2026-11-01 frente a Flutter `7d3fa5f`. Siguen el estilo de teoría y ejemplos comparados con Flutter/Riverpod, sin ejercicios. La numeración refleja el orden de entrega documental: Vender se documentó antes de completar las dos pendientes.

El paquete para Drive reúne estas lecciones en PDF, este informe actual, los informes históricos del 14 y 26 de octubre y un índice. Los archivos Markdown se conservan en GitHub como fuente regenerable. Los PDF y el ZIP quedan en `docs/informes/`, ignorados por git.

## 5. Qué falta

- Recibo térmico PDF con pdfmake, separado de la vista previa HTML de Vender.
- Autorización P-04 completa con supervisor, verificación de servidor y auditoría; se construirá con borrar/archivar pacientes.
- Enlaces históricos ambiguos de revisiones y ensayo de corte sobre una copia fresca de prod.
- Ficha completa S-03 con Revisiones/Ventas/Pagos y política de archivo/restauración por historial.
- E2.7 Dashboard, E2.8 configuración/inventarios/reportes/auditoría/usuarios y resto del sistema de diseño.
- F04–F06; beta, paridad integral, despliegue y pruebas de usuarios.
- Multiempresa, corte de producción y backend NestJS según las fases posteriores.

Egresos conserva totales de página y no incluye filtro por registrador. Historial usa fecha exacta, sin CSV ni rango; el nombre de otro registrador de pagos puede quedar vacío por la política de lectura de perfiles. Estas limitaciones no se confunden con tareas terminadas.

## 6. Evidencia de pruebas y límites

Claude registró 179 tests en verde y build limpio al cerrar E2.6; el dueño probó y aprobó sus tres pasos. Antigravity registró la prueba funcional de Vender, stock, roles, vista previa, abonos y comportamiento móvil. Son resultados de esos agentes; esta entrega documental no los presenta como una ejecución propia nueva.

El permiso de descuento actual controla la interfaz por rol, no implementa P-04 ni una autorización nueva del servidor. El proceso de guardar venta, líneas, stock y pago reúne varias solicitudes y no es una transacción única; un fallo posterior puede dejar escrituras parciales. El descuento de stock lee y actualiza por separado, de modo que no reserva inventario frente a otras sesiones.

Las lecciones explican esas decisiones y límites junto con su equivalente Flutter. Marcar E2.6 significa terminar el alcance publicado de la nueva venta, no certificar toda la plataforma ni dar por terminado el recibo PDF.

## 7. Continuidad desde otra computadora

El repositorio contiene el contexto, fuentes de lecciones, plan, estado y registros de cambios. Después de traer `development`, los PDF se pueden regenerar con `npm run pdf -- <archivo.md>`. La entrega del 2026-11-01 incluye un inventario para Drive en `docs/entregas/2026-11-01-drive.md`.

La conexión de Google Drive requiere habilitar el plugin y autorizar la cuenta del dueño. En la preparación de esta entrega no estaba instalada ni conectada; no se afirma que los documentos estén subidos. Tras habilitarla se debe verificar que permita cargar los PDF y qué carpeta usar.
