# L12: Ficha de paciente, rutas y pestañas (S-03)

**Idea central:** el ID de una persona en la URL permite reunir sus datos, revisiones, ventas y pagos en una ficha. La página organiza la navegación; el store coordina los repositorios; los componentes compartidos conservan las acciones que ya existían.

Solo teoría y ejemplos comparados con Flutter/Riverpod/go_router, sin ejercicios. Revisión del 2026-11-02 sobre Angular: ficha `e6d7a6c` y correcciones de pagos/teclado `e019946`, en `development`. Referencia Flutter `7d3fa5f240ba705c312d9ab2c5a054f815aab80c`, leída en un clon temporal fuera del proyecto. Esta lección continúa L11.

## 1. Qué había en Flutter y por qué aparece esta ficha

En `lib/features/search_patient/`, `SearchPatientView` observa `searchPatientProvider`, muestra una lista paginada de `PatientTile` y escucha banderas del estado para abrir diálogos. `PatientActions` ofrece Ver medidas, Agregar medida, Editar paciente y Eliminar. `ReviewDetailsDialog` presenta las revisiones dentro de un diálogo con tarjetas y botón Cerrar.

Esa pantalla de Flutter no tiene una ficha con encabezado y pestañas Revisiones/Ventas/Pagos. Su router abre `SearchPatientView` en una ruta fija. Las comparaciones de esta clase son analogías de conceptos conocidos, no la descripción de una pantalla Flutter que hubiera que copiar.

S-03 venía del diseño de Claude Design. Se había diferido el 2026-10-27 hasta disponer de Ventas y Pagos. E2.5 y E2.6 aportaron esos contratos y diálogos; ahora se pueden reunir alrededor del mismo paciente. Por decisión del dueño se usa una página propia en `/dashboard/search-patient/:id`, con encabezado y secciones debajo.

| Punto de partida Flutter | Solución de esta entrega Angular |
|---|---|
| Lista `SearchPatientView` con `PatientTile` | Lista `SearchPatientPage` y nueva ruta `PatientDetailPage` |
| Provider de búsqueda y banderas de diálogos | `PatientDetailStore` de página y aperturas desde componentes |
| `ReviewDetailsDialog` para consultar medidas | `ReviewsList` embebido en Revisiones; P-05 conserva el formato |
| Widgets y callbacks reutilizables | C-14 Tabs, lista de revisiones y acciones compartidas |
| Ventas y pagos en otras features | Consultas por ID para reunirlos en la ficha |

## 2. La primera ruta con parámetro de la app

En `app.routes.ts`, el hijo de `dashboard` declara `path: 'search-patient/:id'` y carga `PatientDetailPage` con `loadComponent`. Los dos puntos indican una parte variable: `/dashboard/search-patient/42` entrega el texto `'42'` como ID. No es necesario crear una ruta distinta por paciente.

La diferencia entre dos partes de una dirección se ve aquí:

```text
/dashboard/search-patient/42?tab=payments
                         42 = paciente
                              payments = sección elegida
```

El parámetro de ruta identifica el recurso; el query parameter describe cómo se lo está mirando. Los filtros `?q=&page=` de L05 ya usaban la segunda idea, pero todavía no había una ruta con `:id`.

En go_router, la analogía sería declarar una ruta con `:id` y leer `state.pathParameters['id']`; la pestaña podría leerse de `state.uri.queryParameters['tab']`. Es un ejemplo conceptual: la app Flutter de referencia no implementa esa ficha.

Angular ya tiene configurado `provideRouter(routes, withComponentInputBinding())`. Por eso los nombres de parámetros coincidentes llegan a los inputs de la página:

```ts
readonly id = input.required<string>();
readonly tab = input<string>();
protected readonly activeTab = computed(() => this.tab() ?? 'reviews');
```

`id()` es un signal de entrada obligatorio; `tab()` puede ser `undefined`. Al no recibir pestaña, la vista muestra Revisiones. El ID se conserva como texto, igual que en L07: convertir identificadores históricos grandes a `number` puede perder dígitos. El enlace directo se puede abrir sin haber elegido antes una fila de la lista. Referencia del mecanismo: [withComponentInputBinding, Angular](https://angular.dev/api/router/withComponentInputBinding).

## 3. La URL guarda la pestaña, el store guarda los datos

Al pulsar una pestaña, `setTab` navega sobre la misma ruta con `queryParamsHandling: 'merge'`. Para Ventas escribe `?tab=sales`; para Pagos, `?tab=payments`; al volver a Revisiones asigna `null` y elimina ese parámetro. El router actualiza el input y `activeTab` se recalcula.

No se mantiene otra copia local de la pestaña seleccionada. El historial del navegador permite volver a la sección anterior; al abrir un enlace con `?tab=payments`, se selecciona Pagos directamente. El botón superior Buscar paciente lleva a la ruta base de la lista: ese enlace no conserva los filtros anteriores de la búsqueda.

Hay un límite deliberado del alcance documentado: `salesPage` sí es un signal local que empieza en 1. El paginador de Ventas usa páginas de 10, pero esa página no se escribe en la URL. Recargar conserva el paciente y la pestaña; la paginación vuelve a la primera página. Tampoco hay validación de una pestaña desconocida: un `?tab=otro` no coincide con ninguno de los tres bloques de contenido.

## 4. C-14 Tabs: elegir sección sin convertirse en formulario

`shared/ui/tabs/tabs.ts` recibe `tabs`, `active` y emite `activeChange`. Cada `TabOption` tiene `value`, `label` y un `count` opcional. El componente dibuja botones y el subrayado de la selección; la página decide qué contenido montar usando `@if`.

```html
<onv-tabs
  [tabs]="tabs()"
  [active]="activeTab()"
  (activeChange)="setTab($event)"
/>
```

Desde Flutter se parece a separar una `TabBar` de la selección que observa el padre. No lleva un `TabBarView` propio ni un controlador interno que cargue pacientes. Tampoco implementa `ControlValueAccessor`, a diferencia de controles que escriben un valor de formulario: aquí se navega entre secciones.

El host declara `role="tablist"`; cada botón usa `role="tab"`, `aria-selected`, `aria-controls` y `tabIndex` 0 para el activo y -1 para los demás. En `e019946` se completó el teclado: flechas izquierda/derecha eligen la pestaña vecina de forma cíclica; Home/End van a la primera/última. `viewChildren` permite mover el foco al botón elegido. La ficha monta el contenido con `role="tabpanel"`, ID correspondiente y `aria-labelledby` enlazado a su pestaña. Los helpers `tabId`/`tabPanelId` mantienen esos nombres coordinados.

Los contadores son `computed` de la página. Revisiones usa la longitud de su lista; Ventas usa el total exacto de la consulta paginada, no las diez filas visibles; Pagos usa la longitud de la lista devuelta. Reflejan los datos recibidos, no conteos independientes de todas las tablas.

## 5. Un store que vive con la ficha

La página provee `PatientDetailStore` y `PatientLifecycleActions` en `providers`. Como analogía de Riverpod, el estado del store tiene una duración asociada a esa página, parecida a un provider `autoDispose`; no se vuelve global con `providedIn: 'root'`.

Un `effect` lee `id()` y dispara `loadPatient`, `loadReviews`, `loadSales` y `loadPayments` sin esperar una antes de comenzar las demás. El bloque `untracked` evita que las lecturas internas de signals de esas operaciones se conviertan en dependencias del efecto. Así la carga depende del ID, no de que cambie el saldo o el indicador de carga.

Las cuatro cargas empiezan al entrar, aunque solo se vea una pestaña. `loadComponent` hace lazy loading de la página; eso no significa que sus datos se descarguen recién al abrir cada sección.

`PatientRepository.getById` consulta por igualdad y usa `maybeSingle`: devuelve `Patient` si existe o `null` si no hay fila; un fallo devuelve `AppError` dentro de `Result`. La página distingue skeleton, error del paciente y Paciente no encontrado. El encabezado presenta nombre, avatar, sucursal, teléfono y fecha de registro.

Las listas tienen indicadores propios. Revisiones y Pagos empiezan en `null`, que significa todavía no cargados; una lista vacía significa consulta exitosa sin registros. Ventas guarda filas, total y estado de carga. Esto permite mostrar un estado vacío real sin confundirlo con el primer instante de espera.

## 6. La FK existía, faltaba atravesar el contrato de lectura

El cambio #8 ya había creado `ventas.paciente_id` como FK a `pacientes.id`. E2.6 ya enviaba `NewSale.patientId` al crear una venta. Lo que faltaba era exponer esa relación en el modelo de lectura `Sale`, seleccionarla en Supabase y permitir filtrar por ella con `SaleSearch.patientId`.

Esta entrega añade `Sale.patientId: string | null`, lee `paciente_id::text` y lo transforma en el mapper. El cast conserva el identificador bigint como texto antes de que llegue a JavaScript. El filtro opcional del repositorio agrega `.eq('paciente_id', patientId)`; la ficha siempre lo pasa al buscar ventas.

Dos personas llamadas MARIA LOPEZ pueden compartir nombre, pero no ID. Buscar ventas por el texto visible podría mezclar sus historiales. El contrato nuevo hace que la ficha seleccione la relación exacta; el nombre sigue sirviendo para mostrar y conservar el texto histórico de la venta.

Las ventas antiguas sin enlace mantienen `patientId: null` y no se incluyen automáticamente por coincidencia de nombre. La ficha consume las relaciones existentes; no corrige datos históricos ni aplica una migración nueva. El esquema y el contrato frontend son capas distintas: agregar una FK en PostgreSQL no modifica por sí solo una interfaz TypeScript.

## 7. Pagos de un paciente: recorrer sus ventas

`listBySale(saleId)` ya obtenía pagos de una venta. Pagos de la ficha necesita reunir los de todas las ventas del paciente, incluyendo las que no están en la página visible de Ventas. Por eso se agregó `PaymentRepository.listByPatient(patientId)` y su implementación en Supabase.

| Parte de la consulta actual | Propósito |
|---|---|
| Parte de `pagos` y selecciona `ventas!inner(paciente_id)` | Unir cada cobro con su venta mediante la FK |
| Filtra `.eq('ventas.paciente_id', patientId)` | Conservar solo cobros de esa persona |
| Devuelve `ok([])` si no hay coincidencias | Resolver el vacío en la misma consulta |
| Ordena por fecha e ID descendentes | Mostrar los últimos primero |

`pagos.id_remision` contiene el ID de la venta, no su folio visible ni el ID del paciente. La consulta incluye `perfiles(nombre)` para el registrador. Si RLS no permite leer el perfil de otra persona, su nombre puede quedar vacío aunque el pago exista.

La primera versión (`e6d7a6c`) consultaba IDs de ventas y luego pagos en dos solicitudes. Su comentario decía que faltaba una FK, pero el baseline declara `pagos_id_remision_fkey` y #8 documenta que conserva la referencia interna tras renombrar. Claude verificó la relación en dev y corrigió el método en `e019946`: ahora utiliza una sola consulta con embed. `!inner` hace que el filtro por paciente excluya los pagos de otras ventas; no se limita a adjuntar datos relacionados. Es la relación por FK que explica Supabase en [Joins y tablas anidadas](https://supabase.com/docs/guides/database/joins-and-nesting). No hizo falta una migración nueva.

## 8. ReviewsList: extraer contenido de un diálogo

En la versión anterior de Angular, `ViewMeasuresDialog` reunía el contenedor modal y la lista. La ficha necesita esa misma lista dentro de Revisiones. Se elimina aquel diálogo y se extraen sus tarjetas a `ReviewsList`, conservando P-05 Graduación, LC, AV, motivo e historia clínica.

La idea se parece a extraer un widget hijo del `builder` de un `showDialog` de Flutter para usarlo en el `body` de una pantalla. Cambia el lugar de montaje; la lista sigue recibiendo datos y callbacks.

`ReviewsList` recibe `reviews`, `save`, `remove` y `reload` como inputs. No conserva otra copia de revisiones ni llama a Supabase directamente. Al editar, abre `EditReviewDialog`; al eliminar, pide confirmación. Tras una operación exitosa llama a `reload`, y el store vuelve a entregar la lista que alimenta también el contador.

Agregar medida sigue abriendo `AddReviewDialog` desde la página. El nombre del paciente y Ver medidas del menú de Buscar paciente ahora navegan a la ficha. Si no hay medidas, la pestaña presenta Sin medidas dentro de una tarjeta con `onv-empty-state`, igual que Ventas y Pagos. El vacío ya no impide entrar a la ficha.

## 9. PatientLifecycleActions: un flujo para dos pantallas

La lista y el encabezado necesitan la misma secuencia para eliminar, archivar o restaurar. Copiar `SearchPatientPage.askDelete` en la ficha habría duplicado confirmaciones, autorización de supervisor, mensajes y reglas de rol.

`PatientLifecycleActions` es un servicio sin estado propio del paciente. Recibe el paciente, un objeto que cumpla `PatientLifecyclePort` y un callback `onDone`. Ese contrato pequeño exige `resolveLifecycle`, `applyLifecycle` y `restore`; tanto el store de búsqueda como el de ficha lo pueden satisfacer. Desde Dart, se parece a depender de una interfaz con unos pocos métodos en lugar de una clase de pantalla concreta.

Las acciones coordinan diálogos y delegan en el store. La comprobación definitiva sigue en la Edge Function `patients-lifecycle`, incorporada antes en `b985095`: el frontend no reemplaza la autorización del servidor. Sin relaciones se confirma el borrado; con medidas se exige supervisor o autorización P-04; con ventas se ofrece archivar a admin o superior.

Después de eliminar o archivar desde la ficha, `onDone` navega a Buscar paciente. Para restaurar, el callback recarga al paciente y permanece en su ficha. El mismo flujo sirve para dos pantallas con respuestas diferentes al éxito.

En `e6d7a6c`, un paciente archivado muestra la insignia Archivado, oculta Eliminar y ofrece Restaurar solo a admin o superior. **Editar e Ir a vender siguen presentes en el encabezado**: el cambio condicional afecta Eliminar/Restaurar. Esta precisión evita dar por hecha una restricción más amplia que no está en la plantilla ni en los dos tests añadidos.

## 10. Ventas, abonos y refresco de las dos pestañas

Ventas reutiliza `SaleDetailsDialog` y `RegisterPaymentDialog` de E2.5. Ver detalle carga líneas por folio y pagos por ID de venta. Registrar pago aparece en la fila cuando `sale.rest > 0`.

`PatientDetailStore.registerPayment` inserta primero el pago con el usuario de sesión. Después calcula el nuevo abonado y saldo, y llama a `SaleRepository.applyPayment`. Son dos escrituras, sin una transacción única ni reversión automática si falla la segunda. Se conserva el límite explicado en L11.

Al cerrar exitosamente el formulario, la página vuelve a cargar la página actual de Ventas y el historial de Pagos. Así se actualizan saldo, estado y contadores. El store no elige por su cuenta qué página refrescar: esa información la tiene la vista que coordinó el diálogo.

Ir a vender es un enlace a `/dashboard/sell`. No preselecciona el paciente de la ficha: el `SellStore` de este commit no consume un parámetro para hacerlo. Las consultas de Pagos y Revisiones tampoco tienen paginador propio en esta entrega; sus listas muestran lo devuelto por la API y no garantizan superar sus límites de filas.

## 11. Evidencia de cierre y límites de esta versión

Claude registró 208 tests al construir la ficha, 210 tras los dos arreglos de Antigravity y 216 al incorporar `e019946`, con build limpio. Probó el embed contra la API REST de dev. Antigravity informó aprobación funcional al 100% de la ficha inicial con los cuatro roles: navegación, URL, contadores, edición, pagos y ciclo de vida. Se atendieron sus dos observaciones: Restaurar sustituye a Eliminar en archivados y Revisiones usa el mismo patrón de estado vacío que las otras pestañas.

Son resultados de esos agentes. Codex verifica código/documentación y genera el PDF, sin repetir sus pruebas manuales.

Si falla la primera carga de Revisiones o Pagos, puede quedar un skeleton sin mensaje; Ventas puede mostrar un vacío tras un fallo inicial porque no expone su error. Tampoco hay cancelación ni protección frente a respuestas de un ID anterior. Estos límites de errores y concurrencia permanecen; las carencias de teclado y paneles señaladas en la primera versión se corrigieron en `e019946`.

## 12. Fuentes y PDF

Flutter fijado a `7d3fa5f`: [SearchPatientView](https://github.com/MeloGon/oftal_web/blob/7d3fa5f240ba705c312d9ab2c5a054f815aab80c/lib/features/search_patient/views/search_patient_view.dart), [PatientTile](https://github.com/MeloGon/oftal_web/blob/7d3fa5f240ba705c312d9ab2c5a054f815aab80c/lib/features/search_patient/views/widgets/patient_tile.dart), [ReviewDetailsDialog](https://github.com/MeloGon/oftal_web/blob/7d3fa5f240ba705c312d9ab2c5a054f815aab80c/lib/features/search_patient/views/widgets/review_details_dialog.dart) y [router](https://github.com/MeloGon/oftal_web/blob/7d3fa5f240ba705c312d9ab2c5a054f815aab80c/lib/router/app_router.dart).

Fuentes Angular `e6d7a6c` y `e019946`: rutas/configuración, `patient-detail.page.*`, `patient-detail.store.ts`, `patient-lifecycle-actions.ts`, `components/reviews-list.*`, C-14 y contratos/implementaciones de paciente, venta y pago. Decisiones: `docs/status.md`; FK: baseline y `docs/db-changes.md` #8.

```bash
npm run pdf -- docs/lessons/12-ficha-paciente.md
```

Salida: `docs/informes/12-ficha-paciente.pdf`, ignorada por git; el Markdown permite regenerarla. Se entrega aparte del paquete de Drive del 2026-11-01.
