# Lecciones

Una lección por entregable. Cada una explica qué se hizo, para qué sirve y su equivalente en Flutter.

| # | Tema | Entregable |
|---|---|---|
| 00 | [Anatomía de un proyecto Angular](00-proyecto-angular.md) | E1.3 |
| 01 | [Tokens de diseño y tema](01-tokens-y-tema.md) | E1.5a |
| 02 | [El núcleo (`core/`)](02-core.md) | E1.4a |
| 03 | [Layouts y rutas](03-layouts-y-rutas.md) | E1.4b |
| 04 | [Login, sesión, roles y guards](04-login-sesion-roles.md) | E2.1 |
| 05 | [Buscar, editar y eliminar paciente](05-buscar-paciente.md) | E2.2 |
| 06 | [Agregar paciente](06-agregar-paciente.md) | E2.3a |
| 07 | [Base de datos: IDs, fechas y columnas](07-base-de-datos-ids-fechas-columnas.md) | Cambios #3–#6 |
| 08 | [Revisiones, medidas y P-05 Graduación](08-revisiones-medidas.md) | E2.3b y cambio #7 |
| 09 | [Vender en tres pasos](09-vender.md) | E2.6 y cambios #9/#10 |
| 10 | [Egresos, formularios y categorías](10-egresos.md) | E2.4 |
| 11 | [Historial de ventas y registro de abonos](11-historial-ventas.md) | E2.5 y cambio #8 |
| 12 | [Ficha de paciente: ruta y pestañas](12-ficha-paciente.md) | S-03, C-14 y lectura de relaciones por ID |
| 13 | [Resinas: inventario y búsqueda](13-resinas.md) | E2.8, `1c86dbd` |
| 14 | [Armazones, código de barras e IDs](14-armazones.md) | E2.8 y migración #18, `9793658` |
| 15 | [Auditoría y retención](15-auditoria.md) | E2.8 y migración #17, `eb1530a` |
| 16 | [Ventas por vendedor](16-ventas-por-vendedor.md) | E2.8, agregados y detalle; `d99ced3` |
| 17 | [Reporte de pagos: ingresos y egresos](17-reporte-pagos.md) | E2.8, períodos y totales; `1693555` |
| 18 | [Dashboard v2](18-dashboard.md) | E2.7, roles y métricas |
| 19 | [Recibo PDF térmico](19-recibo-pdf.md) | E2.6, `c5d5950` |
| 20 | [Gestión de usuarios](20-usuarios.md) | E2.8, `53e72de` |

## Fundamentos desde Flutter y Dart

| # | Lectura | Estado de la documentación |
|---|---|---|
| F00 | [Mapa del ecosistema web](fundamentos/F00-mapa-ecosistema-web.md) | Disponible |
| F01 | [TypeScript desde Dart, primera parte](fundamentos/F01-typescript-desde-dart.md) | Disponible |
| F02 | [Objetos y organización de TypeScript](fundamentos/F02-typescript-desde-dart-objetos.md) | Disponible |
| F03 | [HTML y árbol de etiquetas](fundamentos/F03-html-arbol-etiquetas.md) | Disponible |
| F04 | CSS y Tailwind | Pendiente |
| F05 | Componentes y signals | Pendiente |
| F06 | Servicios e inyección | Pendiente |
| F07 | [Recorrido de E2.1](fundamentos/F07-recorrido-e2-1.md) | Revisada y aprobada por el dueño el 2026-10-26 |

Las lecciones nuevas son teoría con ejemplos comparados, sin ejercicios. 00–04, F00–F03 y F07 se conservan sin modificar su contenido: son documentos de su entregable, por lo que algunos pendientes o detalles históricos ya evolucionaron. Para el estado al 26 de octubre se debe leer el [informe de avance](../avance/2026-10-26-informe-de-avance.md) y las lecciones 05–07.

L08 documenta el estado de revisiones del 2026-10-27, incluidas las correcciones tras la prueba manual del dueño. Continúa L05–L07 y actualiza sus referencias a la futura FK de revisiones.

L09–L11 se prepararon el 2026-11-01 comparando Angular `59fa465` con Flutter `7d3fa5f`. L09 atiende Vender; L10 y L11 completan las lecciones pendientes de Egresos e Historial. La numeración refleja el orden de entrega documental. No se modifican las lecciones previas para actualizar sus referencias históricas a componentes o features que llegaron después.

## PDF y entrega para Drive

L13–L17 se prepararon el 2026-11-04 y se contrastaron después del pull con `development` en `e456cfe`: Resinas `1c86dbd`, Armazones `9793658`, Auditoría `eb1530a`, Ventas por vendedor `d99ced3` y Reporte de pagos `1693555`; UI compartida en `55b74fe`. Comparan con Flutter `7d3fa5f`, donde esas funciones usan tarjetas o secciones/tablas repetidas. Incorporan la reverificación de Antigravity y los arreglos posteriores de borrador, mes UTC y aviso de egresos. Solo teoría y ejemplos, sin ejercicios; el dueño autorizó el commit y push de estas fuentes el 2026-11-04. Dashboard, recibo y Usuarios se documentaron después en L18–L20.

PDF individuales: `docs/informes/13-resinas.pdf`, `14-armazones.pdf`, `15-auditoria.pdf`, `16-ventas-por-vendedor.pdf` y `17-reporte-pagos.pdf`. No se incorporan retroactivamente al ZIP histórico del 2026-11-01. Las fuentes de lecciones 00–12 y los informes históricos se conservan.

L12 se preparó el 2026-11-02 sobre `e6d7a6c`, actualizada con las correcciones de pagos/teclado de `e019946`. Explica una mejora nueva sin pantalla equivalente en Flutter: ficha con Revisiones/Ventas/Pagos, ruta `:id`, C-14 y reutilización de acciones/diálogos. PDF individual en `docs/informes/12-ficha-paciente.pdf`; se entrega aparte del paquete histórico del 2026-11-01. Las lecciones 00–11 conservan el contexto de su fecha.

Una lección: `npm run pdf -- docs/lessons/05-buscar-paciente.md`.

Entrega actual (2026-11-01): [guía de archivos para Drive](../entregas/2026-11-01-drive.md) e [informe de avance](../avance/2026-11-01-informe-de-avance.md). Carpeta `docs/informes/drive-2026-11-01/` y ZIP `docs/informes/optinova-drive-2026-11-01.zip`: 17 lecciones, 3 informes e índice, 21 PDF/110 páginas. Incluye todas las clases 00–11 y F00–F03/F07. Los PDF y el ZIP están ignorados por git; hay que transferirlos o regenerarlos en otra computadora. En Windows puede usarse `npm.cmd` si PowerShell bloquea `npm.ps1`.

Entrega histórica: `node scripts/docs/build-delivery.mjs` descubre las lecciones e invoca el comando npm de PDF, pero conserva la fecha y el informe del 2026-10-26 y limpia archivos generados. La biblioteca actual se preparó por separado para conservar también el informe histórico del 14 de octubre. El ZIP actual contiene solo los PDF organizados bajo `Optinova-2026-11-01/`, sin repositorios de referencia ni temporales de revisión.
