# L05: Buscar, editar y eliminar pacientes (E2.2)

**Idea central:** la URL describe qué lista queremos; el store carga su resultado y la página lo presenta. El repositorio conserva los detalles de Supabase fuera de la vista.

Solo teoría con ejemplos comparados con Flutter, Riverpod y go_router, sin ejercicios. Referencia de código Angular: `e3ef363` (2026-10-26). Implementación incorporada en `fd4a892`, `f78967d`, `5135adf` y ajustada por `93b30a4` y `e3ef363`.

## 1. Desde la pantalla Flutter a las capas Angular

Se consultó el repositorio original `MeloGon/oftal_web`, revisión `7d3fa5f`, especialmente `lib/features/search_patient/` y el datasource de pacientes. En Flutter, `SearchPatient` mantiene un controller de búsqueda, offset, tamaño y `hasMore`; la vista observa el provider y presenta filas, paginación y menús.

En Angular las responsabilidades quedan así:

| Archivo o pieza | Equivalente funcional en Flutter |
|---|---|
| `SearchPatientPage` y su HTML | SearchPatientView y sus widgets |
| `SearchPatientStore` | Notifier de búsqueda |
| `PatientRepository` | Contrato del repositorio |
| `SupabasePatientRepository` | Implementación y datasource remoto |
| `Patient` y `Page<Patient>` | Modelo de paciente y resultado paginado |
| Parámetros q, page y size de la URL | Estado de filtros expresado en query parameters de go_router |

La conexión global de `app.config.ts` usa `{ provide: PatientRepository, useClass: SupabasePatientRepository }`. El store pide el contrato con `inject`; la página no llama a Supabase.

## 2. La URL es la fuente de verdad de la búsqueda aplicada

Un ejemplo conceptual es `/dashboard/search-patient?q=ana&page=2&size=25`. `q` contiene el texto aplicado, `page` empieza en 1 y `size` es el tamaño. Con `withComponentInputBinding`, Angular entrega esos parámetros a los `input<string>()` de la página.

El `computed search` recorta el texto y normaliza las cifras: una página inválida vuelve a 1; el tamaño debe ser 10, 25, 50 o 100 y, si no, vuelve a 25. La normalización se aplica a la consulta; no implica reescribir siempre una URL inválida.

Hay dos estados distintos: `text`, un `FormControl`, contiene lo que se está escribiendo; `search()` describe lo que ya se pidió. Escribir no consulta en cada tecla: Enter o «Buscar» aplica el texto y vuelve a la primera página. Si se repite la misma búsqueda estando en página 1, se recarga directamente porque no habría cambio de URL.

En términos de go_router, cambiar de página es navegar con otros query parameters, no incrementar además un contador independiente del Notifier. Esto permite que «Atrás» restaure la búsqueda aplicada. La página también copia el texto de la URL al control al cambiar la navegación. [Referencia: estado de rutas de Angular](https://angular.dev/guide/routing/read-route-state).

El método `navigate` usa `queryParamsHandling: 'merge'`: conserva otros parámetros. El valor `null` quita uno; así se omiten valores por defecto como página 1. Cambiar tamaño reinicia la página. Un `effect` lee `search()` y llama a `store.load`; `untracked` evita que las lecturas internas de esa llamada añadan dependencias accidentales al efecto.

## 3. El contrato y la consulta paginada

El repositorio devuelve `Promise<Result<Page<Patient>, AppError>>`. Como en `Future<Either<Failure, ...>>`, el consumidor distingue éxito y error; `Page<T>` contiene `items` y `total`.

El rango se calcula a partir de la página solicitada:

```ts
const from = (page - 1) * pageSize;
// Extracto de la consulta:
request.range(from, from + pageSize - 1);
```

Con página 2 y tamaño 25 se piden posiciones 25 a 49, ambos extremos incluidos. La consulta solicita el conteo exacto y ordena primero por `fecha_registro` descendente y después por `id` descendente. El segundo orden desempata pacientes registrados el mismo día; no ordenamos en JavaScript sus IDs convirtiéndolos a números.

La búsqueda divide el texto en palabras y agrega un `ilike` por palabra. «garcia juan» encuentra «JUAN GARCIA»: todas las palabras deben aparecer, sin exigir ese orden ni distinguir mayúsculas. `escapeLike` escapa `%`, `_` y barras para que no se interpreten como comodines introducidos por el usuario. No hay una promesa de búsqueda sin acentos: ese comportamiento no está implementado aquí.

En Flutter se usa `textSearch`, se pide una fila extra y se calcula `hasMore`; Angular usa coincidencias por palabra y total exacto. Son implementaciones diferentes, aunque ambas permiten buscar y recorrer resultados. El ID se pide como `id::text`, se mantiene como string y se explica en L07.

## 4. El store protege el resultado más reciente

`SearchPatientStore` se provee en `providers` de la página. Su duración se vincula al componente, comparable al alcance de un provider de pantalla de Riverpod. Su signal privado guarda filas, total, carga, error y `loaded`.

`loaded` distingue «todavía no hubo respuesta» de «la respuesta contiene cero pacientes». Al empezar otra petición conserva las filas anteriores y activa la carga. Si falla, guarda el mensaje y no destruye de inmediato los datos anteriores.

Para evitar que una petición lenta reemplace una búsqueda posterior, usa un número creciente:

```ts
const request = ++this.lastRequest;
const result = await this.repo.search(search);
if (request !== this.lastRequest) return;
```

Es comparable a comprobar en un Notifier que la respuesta pertenece a la consulta vigente. No cancela la petición de red: descarta su resultado si quedó viejo.

`lastSearch` permite recargar los mismos criterios después de editar o eliminar. Si el total es positivo y la página actual supera la última disponible, un efecto navega a la última página. Si el total queda en cero, se muestra el estado vacío; esa corrección específica no se ejecuta porque exige `total > 0`.

## 5. Los componentes reutilizables de shared/ui

Estas piezas separan presentación y comportamiento de la búsqueda. Como los widgets compartidos de Flutter, reciben datos y callbacks; no conocen el repositorio.

| Pieza | Qué hace aquí |
|---|---|
| Badge, C-11 | Etiqueta no interactiva para la sucursal; combina texto, tono e icono opcional |
| Skeleton, C-17 | Ocupa la geometría de las filas durante la primera carga; respeta movimiento reducido |
| EmptyState, C-18 | Explica una lista vacía y recibe acciones mediante proyección de contenido |
| Paginator, C-08 | Recibe página, tamaño y total; emite cambios sin mantener una segunda página propia |
| OnvTable y TableCard, C-07 | Dan estilo a una tabla nativa, scroll y atenuación mientras se renueva |
| ToastService y ToastOutlet, C-13 | Mensajes breves compartidos; semejantes a un snackbar |
| ConfirmService y diálogos, C-12 | Preguntan o editan usando CDK Dialog; recuerdan a showDialog |

La plantilla usa ocho filas de skeleton en la primera carga. Después conserva y atenúa la tabla al solicitar nuevos resultados. Distingue «Aún no hay pacientes» de «Sin resultados» según haya búsqueda aplicada. El error tiene una acción «Reintentar».

`Paginator` calcula el total con `Math.ceil(total / pageSize)` y emite `pageChange` o `pageSizeChange`. La página traduce esos eventos a navegación. Es el equivalente a un widget con `page`, `onPageChanged` y límites recibidos por constructor.

`OnvTable` es una directiva sobre `<table>`; el HTML conserva cabeceras, filas y celdas reales. `TableCard` proyecta el paginador en el espacio marcado `footer`, parecido a pasar widgets para distintas zonas de una tarjeta.

Los toasts muestran como máximo tres mensajes. Éxito e información se retiran después de cinco segundos; peligro y aviso esperan cierre manual. El outlet vive en el layout, de modo que no hace falta recrear un snackbar en cada feature.

## 6. Editar: guardar antes de cerrar

La página abre `EditPatientDialog` con el paciente y una función `save` que delega en `store.update`. Esto separa el formulario del origen de datos, como entregar un callback a un diálogo Flutter.

El diálogo usa Reactive Forms, `onv-field` y `onvInput`. Valida nombre no vacío, sucursal obligatoria y nacimiento no futuro. Los teléfonos del editor actual no tienen los validadores del alta; no debemos atribuirle todas las reglas de L06. Preserva como opción la sucursal histórica aunque esté cerrada.

Al enviar, crea un objeto con spread del paciente y los campos editables. Conserva ID y fecha de registro. Espera el resultado; si falla muestra el error dentro del diálogo y permanece abierto. Si funciona cierra con `true`, recarga la lista y muestra el toast de éxito.

El velo no cierra el editor; Escape pasa por `cancel()` y no cancela mientras guarda. Esto evita perder el formulario por un clic accidental. El CDK aporta la infraestructura del diálogo y el componente propio aporta formulario y estilo.

## 7. Eliminar: comportamiento actual y decisión futura

Hoy `askDelete` solicita confirmación y explica que se borra el paciente, pero no sus revisiones ni ventas. Si se acepta, el store llama a `repo.delete(patient.id)`, recarga la consulta y muestra éxito o error.

En actualización y borrado, `.select('id')` permite comprobar si realmente se afectaron filas. Cero filas produce un error de «ya no existe o no tienes permiso»; no basta con que Supabase no haya devuelto un error SQL. Los IDs de esa respuesta se usan para detectar presencia, no para hacer cálculos.

El dueño ya decidió un comportamiento más completo: borrado por niveles cuando hay medidas, autorización de supervisor y archivo cuando hay ventas o pagos. Es una decisión pendiente, no lo que hace este código. Las opciones de ver y agregar medidas también siguen deshabilitadas en esta revisión.

## 8. Cómo seguir una acción completa

```text
Evento de búsqueda o paginación
  URL -> inputs -> computed search -> effect
  Store -> contrato -> Supabase -> Result<Page<Patient>>
  Signals del store -> tabla, vacío o error
```

La idea que se conserva de Flutter es el flujo vista, estado y repositorio. La diferencia central de esta página es que los criterios aplicados viven en la URL; las filas y su estado de carga viven en el store.

Fuentes del proyecto: commits `fd4a892`, `f78967d`, `5135adf`, `93b30a4`, `e3ef363`; archivos de `src/app/features/search-patient/`, `core/data/supabase-patient.repository.ts` y `shared/ui/`. Referencia Flutter: [repositorio original](https://github.com/MeloGon/oftal_web/tree/7d3fa5f/lib/features/search_patient).
