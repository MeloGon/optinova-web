# L22: Multi-empresa: organizaciones, sucursales y aislamiento

**Idea central:** el sistema deja de ser "una óptica con sucursales escritas en el código" y pasa a ser varias empresas, cada una con sus sucursales, que no se ven entre sí. La separación se garantiza en la base de datos, no en las pantallas.

Solo teoría comparada con Flutter/Riverpod, sin ejercicios. Migraciones #32 a #36, tres Edge Functions y la pantalla de Sucursales (Fase 4b, paso 2).

## 1. Qué cambia respecto a Flutter

En Flutter las sucursales eran un `enum` (`BranchEnum`): agregar una exigía publicar una versión nueva de la app. Aquí son filas de la tabla `sucursales`, y cada una pertenece a una fila de `organizaciones` (la empresa cliente: "Inversiones Oftalvision").

| Flutter | Angular + Supabase |
|---|---|
| `enum BranchEnum` fijo en el código | Tabla `sucursales` con `organizacion_id` y `activa` |
| Una sola empresa implícita | Tabla `organizaciones`; casi todas las tablas llevan `organizacion_id` |
| Filtrar en el cliente (`where`) | RLS en Postgres: la base solo devuelve filas de tu empresa |
| `ref.watch(settingsProvider)` con la lista | `ConfigService.config().branches`, cargado al iniciar sesión |

## 2. Dónde se hace cumplir el aislamiento

Esconder datos en la pantalla no protege nada: cualquiera puede llamar a la API con su propio token. Por eso hay tres capas, de abajo hacia arriba:

1. **RLS (políticas de fila).** Cada tabla de negocio tiene una política "por organización": una fila solo es visible o escribible si su `organizacion_id` es la del usuario. Un `megadmin` (dueño de la plataforma) ve todas. Es como si cada `query` de Firestore llevara un `where companyId == miEmpresa` que el cliente no puede quitar.
2. **Funciones de Postgres (RPC).** Las que antes se saltaban las políticas ahora pasan a ejecutarse con los permisos de quien llama, o filtran por empresa a mano. Las que escriben (`crear_sucursal`, `editar_sucursal`, `crear_organizacion`) validan el rol dentro de la función.
3. **Edge Functions.** Usan la llave de servicio, que se salta toda la seguridad; por eso revisan la empresa en su propio código. Un paciente de otra empresa se trata como inexistente, y el supervisor que autoriza un descuento debe ser de la misma empresa.

Un trigger completa `organizacion_id` al insertar con la empresa del usuario, así la pantalla nunca tiene que mandarlo (equivale a un `createdBy` automático).

## 3. Roles y alcance

| Rol | Ve | Puede |
|---|---|---|
| `admin` | Su empresa | Crear, renombrar, cerrar y reabrir sus sucursales |
| `megadmin` | Todas las empresas | Lo mismo en cualquiera, y crear una empresa nueva con su primer admin |
| `supervisor`, `vendedor` | Su empresa (y su sucursal en reportes) | No administran sucursales |

## 4. Renombrar y cerrar sin perder historial

El nombre de la sucursal se guarda también como texto en ventas, pacientes y revisiones (se dejó así para no romper la app de golpe, patrón *expandir y contraer*). Renombrar actualiza ese texto en todas las filas de la empresa dentro de una transacción: o cambia todo o nada. Puede tardar unos segundos con miles de ventas, por eso el diálogo avisa antes y muestra un contador mientras trabaja, y al terminar dice cuánto tardó.

Cerrar no borra: la sucursal pasa a `activa = false`, deja de ofrecerse en formularios nuevos pero sigue en filtros e historial. La última sucursal abierta de una empresa no se puede cerrar.

## 5. De la tabla a los selectores

`ConfigService` ya no depende de una lista fija. Al restaurar la sesión o iniciar sesión, `SessionStore` pide a `CompanyBranchesService` las sucursales de la empresa del usuario y las deja en `ConfigService`. Todos los selectores (venta, paciente, egreso, filtros) leen de ahí, así que una sucursal creada aparece sin tocar esas pantallas. Tras crear, renombrar o cerrar, la pantalla de Sucursales llama a `reload()`.

Un megadmin puede leer las sucursales de todas las empresas, pero sus selectores muestran solo las de la suya: mezclar empresas en un selector confundiría.

Si la lectura falla, la lista queda vacía en lugar de mostrar sucursales de otra empresa. Es el mismo criterio de "fallar cerrado" de la seguridad.

## 6. Crear una empresa en tres pasos

El asistente pide la empresa, su primera sucursal y su administrador, y manda todo en un solo envío al final. Equivale a un `Stepper` de Flutter que junta los datos en un formulario y llama una vez a `repository.create(...)`. Si se cerrara tras guardar el primer paso quedaría una empresa sin sucursal ni administrador. El servidor además deshace la empresa si no puede crear al administrador (por ejemplo, correo repetido).

## 7. Qué no cubre todavía

Moneda, métodos de pago y zona horaria siguen fijos para todas las empresas. El rol `admin` no crea usuarios: lo hace solo el megadmin. Ambos son decisiones pendientes del dueño.
