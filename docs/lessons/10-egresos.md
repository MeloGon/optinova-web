# L10: Egresos, formularios y categorías (E2.4)

**Idea central:** la lista de egresos se describe en la URL, un store carga su página y un formulario compartido permite crear o editar. La categoría se relaciona por ID; su nombre y color se obtienen al consultar.

Solo teoría y comparación con Flutter/Riverpod, sin ejercicios. Revisión del 2026-11-01 sobre Angular `59fa465`: E2.4 llegó en `e0034f0` y el calendario C-04 en `7b6faf5`, con correcciones posteriores de fecha y tablas. Referencia Flutter `7d3fa5f240ba705c312d9ab2c5a054f815aab80c`, especialmente `lib/features/expenses/`. Esta lección completa un pendiente anterior a L09; su número sigue el orden de entrega documental.

## 1. Reconocer las capas desde Flutter

Flutter usa `ExpensesView`, el Notifier `Expenses`, modelos de egreso/categoría y un repositorio que delega en un datasource. Angular mantiene ese reparto con componentes propios y Supabase detrás del contrato.

| Flutter | Angular |
|---|---|
| `ExpensesView` y widgets de resumen/filtros | `ExpensesPage` y su plantilla |
| `Expenses` con `keepAlive: true` | `ExpensesStore`, provisto en la página |
| `ExpenseModel`, `ExpenseCategoryModel` | Interfaces `Expense`, `ExpenseCategory` |
| Repositorio + datasource remoto | `ExpenseRepository` + `SupabaseExpenseRepository` |
| `ExpenseFormDialog` para alta y edición | Un único `ExpenseFormDialog` con `expense: null` o existente |
| `ExpenseCategoryDialog` | `CategoryDialog` con callbacks de crear y borrar |

Salir de la página destruye el store Angular. La URL conserva la consulta aplicada, no el formulario abierto. El provider Flutter es `keepAlive`.

## 2. La URL conserva la consulta aplicada

`q`, `branch`, `page` y `size` llegan como inputs de la página. El `computed search` forma un `ExpenseSearch`: texto recortado, sucursal o `null`, página y tamaño válidos. Es el mismo patrón aprendido en L05, comparable a expresar filtros mediante query parameters de go_router.

El `FormControl text` contiene un borrador. Escribir no busca inmediatamente: Enter o Buscar aplica el texto y vuelve a página 1. Si se repite la misma búsqueda en la primera página, se llama a `store.load` directamente porque la URL no cambiaría. Cambiar sucursal también reinicia página.

Un `effect` observa la consulta y carga los datos. Otro copia el texto de la URL al input cuando se navega con Atrás. `queryParamsHandling: 'merge'` conserva otros parámetros, y `null` elimina los que deben dejar de filtrar.

Flutter conserva `offset`, `rowsPerPage`, búsqueda y filtros en su estado. Además permite filtrar por `registeredBy`. La versión Angular documentada omite ese filtro: no debe anunciarse paridad de todos los selectores solo porque el listado ya existe.

## 3. Consultar egresos con su categoría

`ExpenseRepository.search` devuelve `Promise<Result<Page<Expense>, AppError>>`. Es comparable a un `Future<Either<Failure, ...>>`; `Page` añade filas y total exacto para el paginador.

La implementación consulta `egresos` y une `categorias_egresos(nombre, color)`. El mapper produce `categoryName` y `categoryColor` para mostrar la fila, mientras `categoryId` mantiene la relación persistida.

```ts
// Fragmentos de SupabaseExpenseRepository.search.
request.or(`descripcion.ilike.%${escaped}%,comprobante.ilike.%${escaped}%`);
request.eq('sucursal', branch);
request.range(from, from + pageSize - 1);
```

Texto vacío significa no aplicar ese filtro. El texto busca una coincidencia parcial en descripción o comprobante; no se divide en palabras como la búsqueda de pacientes. El código prepara los caracteres de patrón antes de construir el filtro.

Se ordena por `fecha` descendente y después `created_at` descendente. Flutter pide una fila extra para calcular `hasMore`; Angular solicita conteo exacto y el rango de la página. Son estrategias distintas para resolver la misma navegación.

No hubo una migración específica de E2.4: las tablas de egresos y categorías ya tenían los nombres, relación y políticas utilizados por esta feature en el baseline. Los nombres ingleses del modelo no obligan a renombrar las columnas de negocio en español.

## 4. Resumen de página y protección ante respuestas viejas

`ExpensesStore` guarda filas, total de registros, categorías, carga, error y `loaded`. Sus signals públicos son lecturas derivadas del estado privado. `lastRequest` aumenta por consulta y evita aplicar una respuesta que corresponde a una búsqueda anterior; no cancela la solicitud de red.

`pageTotal` usa `reduce` para sumar `amount` de las filas cargadas. Se parece al `fold` de Flutter sobre `state.expenses`. **Es la suma de la página visible**, no el gasto de todas las páginas ni un informe mensual. El total exacto del paginador cuenta registros: no es una suma de dinero.

Dos egresos de 20 y 35 suman 55 en esa página, aunque haya otras. Cambiar de página puede cambiar la cifra sin crear ni eliminar egresos.

Flutter también tiene un provider `expensesSummary` que consulta categorías del mes para otra finalidad. No hay que confundirlo con la tarjeta de esta página: su vista suma los egresos que ya tiene cargados.

## 5. Un diálogo para crear y editar

Flutter usa un parámetro opcional `expense`, precarga controllers en `initState` y los libera en `dispose`. Angular recibe `DIALOG_DATA`: egreso o `null`, lista de categorías y una función `save`. El constructor del formulario toma valores existentes o iniciales.

`isEditing` cambia el modo sin duplicar dos componentes. Crear pasa el callback del store para insertar. Editar construye `{ ...expense, ...draft }`, equivalente en intención a `copyWith`, y llama a actualizar.

| Campo | Comportamiento actual |
|---|---|
| Fecha | Obligatoria; C-04 permite escribir o elegir calendario |
| Descripción | `Validators.required`; se recorta al construir la entrada |
| Monto | Obligatorio y mínimo 0.01 |
| Categoría | Opcional: `number` o `null` |
| Método | Opciones procedentes de `ConfigService` |
| Comprobante, sucursal, notas | Pueden quedar vacíos; mapper adapta los vacíos a columnas |

`nonNullable` evita que un control de texto vuelva a `null` al reiniciarse; no equivale a obligatorio. Además, `Validators.required` no es un validador que rechace por sí solo espacios: la descripción se recorta después. Flutter sí comprueba `trim().isEmpty` en su submit. Esa diferencia debe mantenerse visible al comparar las reglas exactas.

El grupo marca todos los controles como tocados y retorna si es inválido o ya está guardando. Luego espera `save`. Con éxito cierra devolviendo `true`; con error muestra el mensaje y conserva lo escrito. Flutter cierra el diálogo antes de llamar al Notifier, por lo que esta espera es una mejora de la experiencia de error en Angular.

## 6. C-04: texto visible y valor de negocio

El calendario propio muestra `dd/mm/aaaa`, pero entrega al formulario un string `yyyy-MM-dd`. Se parece a un widget Flutter que convierte la fecha seleccionada al valor del modelo: lo que ve la persona y lo que viaja a la DB no necesitan la misma representación.

C-04 implementa `ControlValueAccessor`. Como también lee `NgControl`, asigna `ngControl.valueAccessor = this` para evitar la dependencia circular de auto-inyección con provider. El selector escucha y presenta errores del formulario; una fecha escrita con formato inválido se comunica como `invalidFormat` al control.

La corrección de `c5080e8` impide tratar una fecha mal escrita como un texto válido solo porque antes se pudo elegir una fecha desde el calendario. Tiene acciones Hoy/Limpiar y límites configurables; rango y navegación diaria por teclado siguen pendientes del componente.

## 7. Quién registra, refresco y eliminación

`NewExpense` excluye ID, nombre/color de categoría y registrador. La página obtiene el nombre del perfil desde `SessionStore` y lo pasa a `create`; el formulario no permite escribirlo. Flutter hace algo parecido leyendo el perfil de almacenamiento local. Aquí `registrado_por` de egresos es ese texto de nombre; no hay que equipararlo a la FK de usuario usada por los pagos de ventas.

El mapper concentra las columnas: `description` pasa a `descripcion`, `receipt` a `comprobante`, etc. Insertar omite el ID; editar no cambia quién registró el egreso. Tras crear, editar o eliminar, el store vuelve a pedir su última búsqueda aplicada. A diferencia de Flutter, crear no fuerza por sí solo el regreso a la primera página.

Eliminar egreso pide confirmación, muestra carga en la fila y espera el resultado. Si falla, informa con toast; si tiene éxito recarga y avisa. Update y delete comprueban si se afectaron filas, para no anunciar éxito si el registro desapareció o no se pudo tocar.

## 8. Categorías: el mensaje no cambia la FK

`CategoryDialog` recibe el signal público de categorías, no una copia única de sus valores. Cuando el store las recarga después de crear o borrar, el diálogo puede mostrar esa lista actualizada. Se parece a observar el provider de categorías dentro del diálogo Flutter.

Crear captura nombre y uno de los colores preset. Un nombre duplicado devuelve un mensaje específico desde el error PostgreSQL `23505`. El alta de categoría también usa `required` y recorta el texto al enviarlo; no impone un validador adicional de solo espacios.

Flutter dice en su confirmación que borrar una categoría dejará los egresos sin categoría. Sin embargo, el contrato Angular registra que la FK actual no tiene `ON DELETE SET NULL`. Si existen egresos asociados, el servidor rechaza el borrado y el repositorio transforma `23503` en «No se puede eliminar: hay egresos registrados con esta categoría».

La interfaz explica la FK real. Borrar una categoría no implica borrar sus egresos relacionados.

## 9. Alcance y fuentes

E2.4 incluye listado, alta, edición, borrado de egreso y gestión de categorías. Conserva totales de página, deja fuera filtro por registrador y usa la configuración común de sucursales/métodos. El scroll horizontal compartido de tablas se ajustó en E2.6 para evitar comprimir las columnas en móvil.

Claude reportó 135 tests al incorporar E2.4 y build limpio; las mejoras posteriores se verifican en los registros de C-04 y E2.6. El dueño aprobó Egresos y Antigravity dejó su prueba funcional en `docs/status.md`. Esta lección no atribuye una nueva ejecución de esos tests a Codex.

Fuentes Flutter `7d3fa5f`: [feature de Egresos, Notifier y diálogos](https://github.com/MeloGon/oftal_web/tree/7d3fa5f240ba705c312d9ab2c5a054f815aab80c/lib/features/expenses) y [datasource](https://github.com/MeloGon/oftal_web/blob/7d3fa5f240ba705c312d9ab2c5a054f815aab80c/lib/core/data/datasources/remote/expense_remote_datasource.dart). Angular: `features/expenses/`, repositorio de egresos en `core/` y `shared/ui/date-picker/`.

```bash
npm run pdf -- docs/lessons/10-egresos.md
```

Salida regenerable: `docs/informes/10-egresos.pdf`. Se versiona el Markdown; el PDF queda ignorado por git.
