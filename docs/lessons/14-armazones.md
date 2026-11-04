# L14: Armazones, código de barras e IDs de la base (E2.8)

**Idea central:** el inventario debe permitir administrar también los productos agotados. Para crear un armazón, el formulario reúne sus datos y la base asigna el ID; un código de barras es un dato comercial distinto de ese identificador.

Solo teoría con comparaciones Flutter/Riverpod, sin ejercicios. Corte: 2026-11-04, `development` en `e456cfe`, confirmado con pull. Armazones y #18 están publicados en `9793658`; la aplicación en dev y la reverificación exitosa del alta constan en `docs/status.md`/`docs/db-changes.md`. No se ejecuta SQL aquí. Flutter de referencia: `7d3fa5f240ba705c312d9ab2c5a054f815aab80c`. La documentación requiere autorización de commit aparte.

## 1. De tarjetas Flutter a una tabla de inventario

Flutter sí tiene `MountsView`, Notifier `Mounts`, `MountInventoryTile`, búsqueda y diálogo de alta/edición. Alterna lista paginada y `ClientPagedList` cuando busca. Angular mantiene las operaciones y usa `/dashboard/settings/mounts`, con tabla C-07 y paginación del servidor tanto al buscar como al listar.

L13 explica el patrón compartido con Resinas. Armazones añade sucursal, marca, modelo y código de barras; la cantidad se llama `stock` en TypeScript y `existencias` en PostgreSQL.

| Flutter | Angular publicado |
|---|---|
| `Mounts` y controllers en el provider | `MountsStore` de página; `MountFormDialog` con Reactive Forms |
| Tarjetas de monturas | Tabla con marca/modelo, sucursal, stock, precio y acciones |
| Estado local de búsqueda y offset | `?q=&branch=&stock=&page=&size=` |
| ID aleatorio generado en Dart | Alta sin ID y secuencia de DB desde #18 |
| Código de prueba al construir el modelo | Campo editable, persistido como `codigo_barras` |

## 2. Inventario completo y catálogo de Vender

`MountRepository.search` sigue sirviendo al catálogo de Vender: busca por marca/modelo y exige `existencias > 0`. `listInventory` no añade ese requisito: puede mostrar agotados para que se les reponga stock o se editen.

El filtro de texto usa OR entre marca y modelo; sucursal usa igualdad; stock bajo usa entre 1 y 2 y agotado usa 0. La consulta ordena por existencias y marca, luego aplica `range`. Los tres contadores del segmented respetan texto y sucursal, pero no el stock seleccionado ni la página visible.

Los KPI Stock bajo y Agotados sustituyeron a Valor de la página por decisión del dueño. Contar productos que requieren atención tiene una acción más clara que sumar precios de la porción cargada. Estos números tampoco son el total de unidades disponibles ni una valoración contable del inventario.

El store conserva la última consulta, ignora respuestas viejas mediante `lastRequest` y vuelve a cargar al mutar. Como en Flutter con un Notifier, la vista observa el estado y el repositorio decide cómo traerlo; cambiar el layout no traslada las consultas a la plantilla.

## 3. Formulario compartido y código de barras real

`MountFormDialog` recibe `mount: Mount | null`. En alta usa valores iniciales; en edición precarga los del armazón recibido. Su callback guarda un `NewMount`; para editar, la página conserva el ID y combina el borrador con el modelo existente.

Marca, modelo, precio y stock son obligatorios; precio y stock tienen mínimo 0. Color, descripción, sucursal y código de barras pueden quedar vacíos. El formulario obtiene las sucursales de `ConfigService`, sin enumerarlas en el HTML. La cantidad no incorpora un validador explícito de entero ni la marca un validador de solo espacios.

El código de barras se trata como texto: así conserva ceros iniciales. No es el ID de la fila ni se genera con la secuencia. Por ejemplo, un producto puede tener ID interno 42 y código comercial `0012345` sin que haya que convertir uno en el otro.

Hay un detalle importante en el original: `barcodeController` existe y se precarga al editar, pero `_createMount` construye el modelo con el literal `codigo barra de prueba`. Ese método se utiliza tanto para alta como para edición. Precargar un controller no implica que su valor llegue al repositorio. Angular sí envía `barcode.trim()` desde el formulario; el mapper lo escribe en `codigo_barras`.

## 4. Migración #18: por qué un formulario correcto no podía guardar

Antigravity encontró que el alta fallaba con `null value in column "id"`. El insert Angular no envía `id`, pero el cambio #9 solo había renombrado la columna vieja: todavía no tenía un default que lo generara.

La migración #18 crea `armazones_id_seq`, la vincula a la columna y añade `nextval` como default. Su inicialización sigue este esquema real:

```sql
select setval(
  'public.armazones_id_seq',
  (select coalesce(max(id), 0) + 1 from public.armazones),
  false
);
```

`false` indica que el próximo `nextval` debe entregar ese valor, sin adelantarlo otra vez. Se usa el máximo existente más uno para que el mismo cambio sirva sobre los datos de dev y sobre una copia de prod durante el corte. No se reasignan IDs antiguos ni se fija el inicio al máximo conocido de una máquina de pruebas.

En Dart, el Notifier generaba 17 dígitos aleatorios antes del insert. Con una secuencia, la responsabilidad pasa a PostgreSQL y los clientes no coordinan IDs. Pueden quedar huecos: un ID no es un conteo de productos.

Permanece una limitación relevante para el corte: `Mount.id` y el mapper aún usan `number`, mientras hay identificadores históricos de 17 dígitos. La secuencia evita inventar IDs repetidos, pero no corrige su posible pérdida de precisión en JavaScript. Debe revisarse el transporte como texto, como ya se hizo en pacientes y revisiones. Esta clase no modifica ese contrato.

## 5. Mutación y auditoría son dos operaciones

Después de insertar, actualizar o borrar, `MountsStore` lanza un evento `create_mount`, `update_mount` o `delete_mount` y recarga la búsqueda. Si falla el log, no se revierte el producto. Flutter ya tenía auditoría best-effort para armazones; Angular conserva ese criterio y utiliza el contrato común de L15.

El detalle Angular registra marca, modelo, color, precio, existencias y sucursal. No incluye todos los campos ni un diff antes/después como el que Flutter preparaba para ciertas ediciones. No hay que presentar esta fila como copia íntegra del producto o garantía de reconstrucción histórica.

La ruta exige admin o superior. El guard controla la navegación; las autorizaciones de datos siguen dependiendo de RLS. Cambiar stock desde este formulario tampoco hace atómicas las operaciones de descuento de Vender, que siguen siendo otro flujo.

## 6. Evidencia y regeneración

Claude reportó #18 aplicada en dev y un insert real exitoso. Antigravity reconfirmó el alta desde el navegador y la búsqueda con guion bajo; Claude corrigió después el borrador usando un efecto dependiente solo de `q()`. La asociación de errores accesibles y C-07 quedaron en `55b74fe`. El código está publicado; esta revisión documental no repite aquellas pruebas ni autoriza su propio commit.

Fuentes Angular: `features/mounts/`, repositorio/mapper de armazones y migración `20261104170000_armazones_id_secuencia.sql`. Flutter: [MountsView](https://github.com/MeloGon/oftal_web/blob/7d3fa5f/lib/features/settings/views/mounts/mounts_view.dart) y [Notifier Mounts](https://github.com/MeloGon/oftal_web/blob/7d3fa5f/lib/features/settings/viewmodels/mounts/mounts_provider.dart). Esquema y prueba registrada: `docs/db-changes.md` #18 y `docs/status.md`.

```bash
npm run pdf -- docs/lessons/14-armazones.md
```

Salida: `docs/informes/14-armazones.pdf`, ignorada por git; fuente Markdown versionable.
