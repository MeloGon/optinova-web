# L09: Vender en tres pasos (E2.6)

**Idea central:** elegir paciente, armar el carrito y confirmar son tres vistas del mismo borrador de venta. La página decide qué paso mostrar; el store conserva el negocio y los repositorios guardan sus datos.

Solo teoría y ejemplos comparados con Flutter/Riverpod, sin ejercicios. Estado revisado: 2026-11-01, Angular `59fa465` y Flutter `7d3fa5f240ba705c312d9ab2c5a054f815aab80c`. La referencia Flutter se descargó del repositorio original a una carpeta temporal fuera del proyecto. Los ejemplos son ficticios. Esta entrega documental no modifica código ni aplica migraciones.

E2.6 publicado incluye S-04, los tres pasos, catálogo, carrito, stock, descuento por rol, abono inicial y vista previa. **El recibo PDF imprimible queda como entregable separado**, por decisión del dueño del 2026-10-31. El PDF de esta lección es documentación del curso, no ese recibo.

## 1. Qué se conserva del recorrido Flutter

La pantalla activa de Flutter es `lib/features/sell/views/sell_view.dart`. Presenta secciones con `StepCard`: buscar paciente, seleccionar productos y revisar la nota. Usa `PatientResultList`, `SellCatalogTiles` y `SellItemCard`; el Notifier `Sell` concentra los controllers y operaciones.

Angular conserva ese recorrido de negocio y lo organiza con S-04 de Claude Design. Muestra un paso por vez mediante `@switch (currentStep())`, comparable a elegir un widget según el estado. El carrito vive por encima de esos componentes y permanece al ir al siguiente paso.

| Flutter activo | Angular |
|---|---|
| `SellView` y sus secciones | `SellPage`, `PatientStep`, `ProductsStep`, `CheckoutStep` |
| `Sell` Notifier con `keepAlive: true` | `SellStore` provisto en la página |
| `SellState.copyWith` | Signal privado y actualizaciones con spread |
| Controllers de búsqueda y cobro | `FormControl` y métodos del store |
| `StepCard` | C-22 `Stepper` y pie de navegación |
| `SalesDetailsModel` para el carrito | `CartLine` con `NewSaleItem` |
| Repos y datasources | Contratos abstractos e implementaciones Supabase |

No todos los archivos dentro de `sell/` describen el flujo vigente. `invoice_widget.dart` contiene un ejemplo con textos fijos y no se importa desde la vista activa. El recibo real de Flutter se genera desde `shared/services/receipt_pdf_service.dart`, llamado por el Notifier. Comparar solo el nombre de un archivo habría llevado a documentar otra pantalla.

## 2. Un store compartido y una página que navega

`SellPage` declara `providers: [SellStore]`; los tres pasos obtienen esa misma instancia con `inject(SellStore)`. Se parece a varios widgets observando un único provider de Riverpod. El store nace y muere con la página. A diferencia del `keepAlive` de Flutter, no conserva automáticamente el carrito al salir de la ruta y volver.

La página guarda `currentStep`, un `signal<1 | 2 | 3>`. El store guarda paciente, vendedores, sucursal, fecha, revisiones, catálogo, carrito, descuento, abono y estado de guardado. Separar estas responsabilidades evita que decidir la pestaña visual cambie los cálculos de una venta.

El paso 1 permite continuar al elegir paciente; el paso 2 exige un carrito no vacío. El paso 3 consulta `canConfirm()`. La cabecera C-22 muestra pasos completos, actual y futuros; su output `stepClick` permite volver a uno completo. El componente actual usa botones, inputs y outputs propios: no debe suponerse que extiende `CdkStepper` por una mención en su comentario.

Al cambiar de paso, `@switch` destruye un componente y crea otro. Lo persistente está en el store; los controles y banderas locales pertenecen al componente de ese paso. Esto recuerda la diferencia entre el estado de un widget y el de un provider situado por encima.

## 3. Paciente, revisión y vendedor son datos distintos

`PatientStep` aplica una búsqueda explícita. `searchPatients` pide al repositorio la primera página, con hasta 20 pacientes; no es un listado ilimitado. Elegir paciente guarda su modelo y carga vendedores y revisiones en paralelo con `Promise.all`, equivalente a esperar varias operaciones con `Future.wait`.

Las medidas se consultan por ID mediante `ReviewRepository`, como se explicó en L08. Por defecto se presenta la más reciente; se puede elegir otra. P-05 `RxTable` muestra esa graduación también en el paso de revisión, usando el modo `compact`.

Esa selección de revisión es una referencia visual durante la venta. El `NewSale` actual no incluye un `reviewId` ni copia la graduación a las líneas. No hay que interpretar «graduación que se usará» como una nueva relación persistida que el esquema todavía no guarda.

El vendedor seleccionado viene de la tabla `vendedores`. No es necesariamente el usuario autenticado: este último procede de `SessionStore` y se usa para atribuir el pago a `registrado_por`. La sucursal inicial también viene del perfil, mientras que las opciones disponibles proceden de `ConfigService`.

Cambiar paciente con `changePatient()` reinicia el borrador completo. El flujo aún no incorpora alta de paciente dentro de un diálogo ni aviso de deuda previa; el enlace abre Agregar paciente (`/dashboard/add-patient`) y no promete conservar el carrito al abandonar la ruta.

## 4. Catálogo: buscar lo necesario, de diez en diez

El paso Productos distingue el texto que se escribe de la consulta aplicada. Entrar al paso o cambiar categoría/sucursal no descarga automáticamente todo el inventario. «Buscar» solicita los resultados; el paginador repite la última consulta con otra página. «Limpiar» también ejecuta una consulta vacía de forma explícita.

Los contratos devuelven `Page<Mount>` o `Page<Resin>`, con `items` y total exacto. El store fija `catalogPageSize = 10`. Las implementaciones calculan el rango inclusivo de Supabase:

```ts
const from = (page - 1) * pageSize;
// Fragmento de la consulta paginada.
request.range(from, from + pageSize - 1);
```

Página 2 de tamaño 10 solicita posiciones 10 a 19. A diferencia de un `ListView` que corta una lista ya descargada, este rango limita las filas pedidas al servidor.

Los armazones se filtran por marca o modelo, sucursal opcional y existencias mayores que cero. Las resinas buscan en `descripcion` **o** `texto`; la referencia Flutter consultaba solo `texto`, por lo que escribir el nombre mostrado podía no encontrar el producto. Los métodos de búsqueda Flutter usados por Vender no aplican ese rango; no deben confundirse con sus métodos `fetchPage`, destinados a otras listas.

La sucursal usada para filtrar armazones es `catalogBranch`, distinta de la sucursal de la venta, `branch`. No hay categoría «Otros»: todavía no existe su fuente de datos.

## 5. Cada unidad es una línea del carrito

`NewSaleItem` es una unión discriminada de TypeScript: `kind: 'mount'` trae campos de armazón y `kind: 'resin'` trae los de resina. Se parece a una unión de freezed: comprobar `kind` permite saber qué propiedades existen, sin convertir un `dynamic` con un cast como hace el Notifier Flutter.

Cada `CartLine` añade `localId` y una etiqueta. Ese ID identifica una fila del borrador, no una clave de la DB. Agregar el mismo armazón dos veces crea dos líneas con precio independiente, no una línea con cantidad 2.

La fila del catálogo representa esas líneas como `− cantidad +`. Quitar una unidad elimina una de ellas; quitar desde la nota usa su `localId`. Para mostrar disponibilidad, el componente calcula `stock del catálogo - líneas de ese armazón en el carrito` y deshabilita sumar cuando llega a cero.

El paso 3 permite editar precios unitarios. La moneda se presenta con `MoneyPipe` y la configuración del proyecto, sin fijar un símbolo en la plantilla. Un contador de unidades y una suma de importes tienen responsabilidades diferentes: el total actual suma el precio de cada línea porque cada una representa una unidad.

## 6. Totales derivados en lugar de controllers sincronizados

Flutter mantiene controllers para importe, descuento, total, cuenta y resto. `_recalculateTotals`, `applyDiscount` y `leaveAccount` escriben varios de ellos para mantenerlos consistentes. Angular deriva los valores desde el carrito y dos importes con `computed`:

```ts
// Fórmulas del store; nombres abreviados para explicar la relación.
total = sumaDePrecios;
totalWithDiscount = Math.max(total - discount, 0);
rest = Math.max(totalWithDiscount - account, 0);
```

Si el carrito suma 700, el descuento es 100 y el abono inicial 200, total a cobrar es 600 y saldo 400. Estos valores se recalculan al cambiar sus dependencias; no hace falta actualizar además un controller de saldo.

Agregar o quitar una línea reinicia descuento y cuenta, como parte del comportamiento heredado. Cambiar su precio conserva ambos y recalcula el resultado. `setDiscount` y `setAccount` limitan el mínimo a cero; las fórmulas impiden resultados negativos de total/saldo.

Eso no equivale a una validación completa de cobro: el store no rechaza un descuento mayor que el bruto ni una cuenta mayor que el total. El input del abono ofrece un máximo HTML, pero `confirmSale` no añade una comprobación de ese límite. La lección distingue el cálculo existente de reglas que aún no están verificadas en servidor.

## 7. Descuento por rol y P-04 pendiente

La vista activa Flutter muestra el descuento cuando hay productos y llama a `applyDiscount`; no contiene la autorización de supervisor que el plan antiguo daba por existente. Tampoco aparece una autorización especial en `createSale`.

La decisión del dueño introduce un permiso simple: `canApplyDiscount` consulta `session.can('supervisor')`. Un vendedor ve el descuento bloqueado; supervisor, admin y megadmin pueden capturarlo. Es una diferencia deliberada respecto de Flutter.

**P-04 completo sigue pendiente:** pedir correo y contraseña de otro supervisor sin cerrar la sesión, verificar en Edge Function y registrar quién autorizó. Se construirá con borrar/archivar pacientes y luego podrá reutilizarse aquí.

El permiso actual se aplica a la presentación del campo. `setDiscount` y `confirmSale` no vuelven a comprobar el rol; esta implementación no agrega una regla de autorización del descuento en el servidor. Por eso un control oculto no se debe enseñar como equivalente a la futura autorización auditada.

## 8. Qué aportan las migraciones #9 y #10

Las dos ya están aplicadas en **dev (optinova-db)** según `docs/db-changes.md`; **prod (oftal-test-web)** conserva su esquema hasta el corte. Se documentan aquí, sin ejecutar SQL nuevo.

| Cambio | Responsabilidad |
|---|---|
| #9 `20261031120000_catalogo_columnas_limpias.sql` | Limpia nombres de columnas de armazones, resinas y vendedores; conserva fecha textual de armazón como respaldo y elimina tres columnas de importación comprobadas como basura |
| #10 `20261031130000_ventas_ids_automaticos.sql` | Asigna por secuencias `ventas.id`, `ventas.folio` y `venta_items.id` |

Flutter generaba ID y folio aleatorios al elegir paciente. Angular omite esos valores al insertar y usa los devueltos por la DB. `ventas.id` y `folio` siguen viajando como texto. Una secuencia asigna nuevos valores a partir del mayor existente; no corrige ni deduplica folios históricos.

El registro del cambio #10 reporta 17,872 folios distintos en 24,827 ventas de la referencia de prod: motivó dejar de inventarlos en el navegador. Es un diagnóstico histórico registrado por Claude, no una consulta de datos de pacientes ejecutada en esta sesión.

## 9. Orden de escritura: la FK cambia el recorrido

Flutter ejecuta descuento de stock, inserción de detalles y después creación del encabezado en la tabla antigua `ventas cortas`. Podía insertar detalles primero porque esa relación no tenía la FK real que ahora usa dev.

La migración #8 de E2.5 dejó `venta_items.venta_id` apuntando a `ventas.id`. Angular necesita el padre antes que sus hijos, igual que guardar primero un registro maestro y después los modelos que lo referencian.

| Orden actual | Operación y responsable |
|---|---|
| 1 | `SaleRepository.create` inserta encabezado en `ventas`, sin ID/folio inventados |
| 2 | Inserta las líneas en `venta_items` con el ID y folio devueltos |
| 3 | `SellStore` agrupa unidades de armazón y pide descontar stock |
| 4 | Si hay cuenta inicial, crea el registro en `pagos` |
| 5 | Conserva un `SellSnapshot`, reinicia el store y devuelve éxito |

Las líneas nuevas guardan cantidad `'1'`; dos unidades son dos filas. `paciente_id` se toma del paciente elegido y `paciente_nombre` conserva el texto de la venta. El nombre y el ID cumplen funciones distintas.

## 10. Stock: cantidad explícita y momento del descuento

El arreglo señalado en `status.md` como bug de Flutter cambia el contrato de stock. Su datasource recibe `currentStock` y resta una unidad por llamada; Angular recibe `quantity`, agrupa las líneas del mismo armazón y resta esa cantidad.

Hay un matiz de la referencia: el Notifier Flutter recorre las líneas y puede llamar varias veces al datasource. **«Resta 1 por llamada» no demuestra que reste solo 1 en toda venta con líneas repetidas.** La mejora verificable es expresar la cantidad agrupada y ejecutar el descuento después de crear encabezado y detalles, no reproducir una resta fija antes de saber si la venta se creó.

Por ejemplo, tres líneas del armazón 10 generan una sola llamada `decrementStock(10, 3)`. El repositorio vuelve a leer sus existencias y escribe `Math.max(existencias - quantity, 0)`. Las resinas no reciben un descuento de stock en este flujo.

La disponibilidad visible del carrito no reserva inventario. El repositorio lee y luego actualiza en solicitudes separadas, sin bloqueo ni resta atómica; otra sesión puede competir por el mismo stock. Corregir la cantidad y su orden no convierte el flujo en una transacción concurrente de inventario.

## 11. Pago inicial, vista previa y confirmación visual

Si `account > 0`, `canConfirm` exige método de pago. Además exige paciente, vendedor, sucursal y productos. El abono inicial lleva `type: 'nueva_venta'`, fecha de la venta, nota y el ID del usuario autenticado como registrador. Con cuenta cero no se crea un pago. Los abonos posteriores pertenecen al Historial de ventas y usan `abono_saldo`.

«Ver y confirmar» abre `SalePreviewDialog` con los valores del borrador y un callback `confirm`. Es como pasar datos y una función por el constructor de un widget. Abrirlo no escribe: la venta se crea al confirmar dentro del diálogo. El folio definitivo no se inventa para esa vista previa.

El diálogo muestra `saving` y conserva el error si falla. Con éxito devuelve un `SellSnapshot`, que conserva venta e ítems después de limpiar el store. La página vuelve al paso 1 y abre `SaleCreatedDialog`, con folio, total y saldo. «Ver venta» navega a Historial con el folio como query parameter; filtra la lista, no abre automáticamente su detalle.

Flutter genera y descarga el ticket térmico de 80 mm desde `ReceiptPdfService` después del guardado. Angular todavía no tiene esa descarga. `SalePreviewDialog` es HTML para revisar; `SaleCreatedDialog` es confirmación del resultado. Ninguno demuestra que el entregable de recibo PDF esté terminado.

## 12. Límites y verificación de lo implementado

Las escrituras son varias solicitudes, sin transacción ni reversión automática. Si falla insertar las líneas, puede quedar el encabezado; si después falla stock o pago, pueden existir venta y líneas. El store muestra el error y conserva el borrador en esas ramas. Reintentar no tiene una clave de idempotencia que garantice reutilizar la venta anterior.

Estos límites se deducen del código secuencial y deben distinguirse de las simplificaciones decididas: sin P-04 completo, sin alta de paciente dentro del flujo, sin aviso de deuda, sin categoría Otros y sin recibo PDF. Tampoco hay una reserva de stock ni una nueva FK para la revisión elegida.

Claude reportó 179 tests en verde y build limpio, y el dueño probó los tres pasos el 2026-11-01. Los tests del store incluyen totales, catálogo de diez en diez, búsqueda por descripción, agrupación de stock, pago inicial opcional y reinicio. Esta entrega revisa esas fuentes y genera documentación; no presenta esas pruebas como una ejecución propia.

## 13. Fuentes y PDF de la lección

Referencia Flutter fijada a `7d3fa5f`: [vista activa](https://github.com/MeloGon/oftal_web/blob/7d3fa5f240ba705c312d9ab2c5a054f815aab80c/lib/features/sell/views/sell_view.dart), [Sell Notifier](https://github.com/MeloGon/oftal_web/blob/7d3fa5f240ba705c312d9ab2c5a054f815aab80c/lib/features/sell/viewmodels/sell_provider.dart), [datasource de armazones](https://github.com/MeloGon/oftal_web/blob/7d3fa5f240ba705c312d9ab2c5a054f815aab80c/lib/core/data/datasources/remote/mount_remote_datasource.dart) y [recibo térmico real](https://github.com/MeloGon/oftal_web/blob/7d3fa5f240ba705c312d9ab2c5a054f815aab80c/lib/shared/services/receipt_pdf_service.dart).

Fuentes Angular: `features/sell/`, `shared/ui/stepper/`, contratos y repositorios de venta, pago y catálogo en `core/`, todos en `59fa465`. Decisiones y cambios de DB: `docs/status.md`, `docs/db-changes.md` y migraciones/transforms #8–#10.

```bash
npm run pdf -- docs/lessons/09-vender.md
```

Salida: `docs/informes/09-vender.pdf`, ignorada por git. El Markdown se versiona y permite regenerar la documentación en otra computadora.
