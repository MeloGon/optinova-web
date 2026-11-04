# L13: Resinas, inventario y estado de búsqueda (E2.8)

**Idea central:** administrar el catálogo y elegir una resina para una venta son operaciones distintas sobre los mismos datos. La pantalla de inventario añade búsqueda, estados de stock, formulario y auditoría al repositorio que ya utilizaba Vender.

Solo teoría con ejemplos comparados con Flutter/Riverpod, sin ejercicios. Corte: 2026-11-04, `development` en `e456cfe`, confirmado con pull. Resinas está publicada en `1c86dbd`; arreglos compartidos en `55b74fe` y rutas/providers en `e456cfe`. Antigravity registró reverificación aprobada; Claude documentó las correcciones posteriores. Referencia Flutter: `7d3fa5f240ba705c312d9ab2c5a054f815aab80c`, clon temporal externo. El commit de esta documentación requiere autorización aparte.

## 1. La función existe en Flutter; cambia su presentación

Flutter tiene `ResinsView`, el Notifier `Resins`, `ResinInventoryTile` y un diálogo compartido para añadir/editar. La vista usa `PagedListCard` y `ListPaginationBar`: es una lista paginada de tarjetas. El Notifier conserva controllers de texto y los libera con `ref.onDispose`.

Angular ofrece la misma administración en `/dashboard/settings/resins`, con tabla C-07, buscador y filtro Todas/Stock bajo/Agotadas con contadores. No se debe decir que Flutter carece de Resinas: lo nuevo es este diseño y sus filtros.

| Flutter | Angular publicado |
|---|---|
| `ResinsView` y tarjetas | `ResinsPage` y tabla con C-08 Paginator |
| Notifier con controllers y flags de diálogo | `ResinsStore` para datos; formulario dentro de `ResinFormDialog` |
| Offset, tamaño y `hasMore` | Parámetros de URL, página y conteo exacto |
| Modelo construido desde controllers | `NewResin` tipado y mapper Supabase |
| Formulario compartido para alta/edición | Un diálogo con `resin: Resin \| null` y callback `save` |

## 2. URL aplicada y texto que todavía se está escribiendo

La URL describe la búsqueda aplicada: `?q=policarbonato&stock=low&page=2&size=25`. Los inputs `q`, `stock`, `page` y `size` llegan desde el router. Un `computed` los convierte en `ResinInventorySearch`: página mínima 1, tamaño entre 10/25/50/100 y stock `all`, `low` u `out`.

El `FormControl text` guarda el borrador del buscador. Escribir no consulta inmediatamente; Enter o Buscar aplica el texto a la URL. Si se vuelve a buscar lo mismo en la página 1, la página llama a `load` para refrescar, aunque el router no tenga una dirección nueva que activar. Limpiar borra el texto, sin resetear necesariamente el filtro de stock.

Desde go_router, es comparable a reconstruir la consulta desde `uri.queryParameters` y mantener aparte el controller de edición. Cambiar el tamaño o el stock reinicia la página. Atrás del navegador permite volver a una búsqueda anterior.

El efecto de sincronización escucha solo `q()`, no el objeto de búsqueda completo, y llama a `setValue` si el valor difiere. Así, cambiar stock conserva el borrador todavía no enviado; cambiar el texto aplicado en la URL sí actualiza el control. La guardia por igualdad sola no bastaba: Antigravity encontró que el efecto sobre `search().query` se reejecutaba al cambiar otros filtros y borraba el borrador. Claude corrigió esa dependencia.

## 3. Página y contadores se consultan por separado

`listInventory` busca por descripción o texto compuesto y ordena primero por cantidad y después por descripción. La página 2 de tamaño 25 solicita posiciones 25 a 49 con `range`: la API devuelve solo esa porción y su conteo exacto.

`countByStock` ejecuta tres conteos `head: true`, con el mismo texto pero sin limitarse a la página visible. Stock bajo significa de 1 a 2 unidades, agotadas significa exactamente 0 y Todas incluye el conjunto completo. No hay filtro por sucursal para resinas: el modelo actual no tiene ese campo.

`ResinsStore.load` pide página y contadores con `Promise.all`. Un número `lastRequest` evita que una respuesta antigua reemplace una búsqueda posterior. No cancela las solicitudes anteriores: simplemente ignora sus resultados si ya no son los más recientes.

Si falla la lista, se conserva un mensaje de error; si solo fallan los contadores, se mantienen los anteriores. La franja puede estar temporalmente desactualizada aunque la tabla sea nueva. Los indicadores de carga, error y primera respuesta permiten distinguir skeleton de catálogo vacío.

## 4. Un solo formulario y un nombre compuesto

`ResinFormDialog` crea un `FormGroup` con descripción, diseño, línea, material, tecnología, precio, precio interno y cantidad. Descripción, precio y cantidad son obligatorios; los valores numéricos tienen mínimo 0. Precio interno puede quedar vacío y se convierte en 0 al construir el borrador.

`markAllAsTouched` permite mostrar los errores al intentar guardar; `form.invalid` y `saving()` bloquean el envío. Los textos se recortan después de validar. `required` por sí solo no equivale a rechazar una cadena de espacios, y la cantidad no tiene un validador explícito de entero. Conviene distinguir la regla implementada de la que pudiera esperarse del negocio.

El callback `save` devuelve `Result`. Si funciona, el diálogo cierra con `true`; si falla, conserva los datos y muestra el error. Se parece a un `showDialog` cuyo formulario espera la operación antes de devolver un resultado.

`NewResin` omite `id` y `text`. El repositorio une descripción, diseño, línea, material y tecnología para generar `texto`, como hacía Flutter al construir el modelo. También traduce `priceInternal` a `precio_interno` e `id_oftalmico` al `id` del modelo. El alta Angular omite el ID y utiliza el valor de DB; Flutter generaba uno aleatorio desde Dart.

## 5. Guardado, auditoría y recarga

Después de insertar, editar o borrar, el store repite la última búsqueda para actualizar filas y contadores. Borrar exige confirmación. Los métodos de actualización/eliminación piden de vuelta el ID para detectar el caso de cero filas afectadas, que puede significar registro inexistente o falta de permiso.

El store también lanza `AuditLogRepository.log` con `create_resin`, `update_resin` o `delete_resin`. Es auditoría best-effort: el resultado del log no bloquea el guardado ni revierte el inventario. El detalle contiene campos de la operación, no un historial completo de antes/después. Esta escritura y la mutación no forman una transacción única. La pantalla de lectura de esos eventos se explica en L15.

La ruta exige admin o superior mediante `roleGuard`. Esa navegación protegida no cambia las políticas RLS existentes: no debe enseñarse como si el navegador pudiera imponer por sí solo permisos de DB.

## 6. Búsquedas literales y componentes compartidos

`ilike` interpreta `%` y `_` como comodines. La nueva utilidad `core/supabase/escape-like.ts` los escapa con una función de reemplazo. Corrige el doble escape detectado por Antigravity y se comparte entre repositorios que construyen filtros OR. No es una sanitización general de toda la sintaxis de filtros.

El arreglo C-07 de alineación también afecta esta tabla: el estilo por defecto de encabezado izquierdo excluye celdas que declaren `text-right` o `text-center`. Cantidades y precios pueden alinear su encabezado con sus valores. L16 explica la causa de especificidad CSS.

## 7. Evidencia, fuentes y PDF

Antigravity comprobó filtros, contadores, validaciones, CRUD y eventos, y registró reverificación aprobada. Claude corrigió después la dependencia del buscador y reportó 346 tests en verde/build limpio. Codex contrastó los archivos con `e456cfe` tras el pull; no repitió pruebas de navegador ni escribió en dev (optinova-db) o prod (oftal-test-web). El código está publicado; la documentación espera su propia autorización.

Fuentes Angular: `features/resins/`, `core/repositories/resin.repository.ts`, `core/data/supabase-resin.repository.ts`, auditoría y utilidad de escape. Flutter: [ResinsView](https://github.com/MeloGon/oftal_web/blob/7d3fa5f/lib/features/settings/views/resins/resins_view.dart), [Notifier Resins](https://github.com/MeloGon/oftal_web/blob/7d3fa5f/lib/features/settings/viewmodels/resins/resins_provider.dart) y [datasource](https://github.com/MeloGon/oftal_web/blob/7d3fa5f/lib/core/data/datasources/remote/resin_remote_datasource.dart).

```bash
npm run pdf -- docs/lessons/13-resinas.md
```

Salida: `docs/informes/13-resinas.pdf`, ignorada por git. El Markdown permite regenerarla.
