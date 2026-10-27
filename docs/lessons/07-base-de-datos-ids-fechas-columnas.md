# L07: Base de datos: IDs, fechas, columnas y migraciones

**Idea central:** algunos datos deben viajar con una representación distinta de la que se usa para calcular. Un ID identifica, una fecha de calendario no es una hora y una migración conserva la receta del cambio para reproducirla en el corte final.

Solo teoría con ejemplos comparados con Dart/Flutter, sin ejercicios. Se describe el código y los archivos hasta `e3ef363` del 2026-10-26. Esta lección no ejecuta cambios en ninguna base de datos.

## 1. Por qué un ID de paciente viaja como texto

JavaScript usa `number` para enteros habituales y decimales. Su mayor entero seguro es **9,007,199,254,740,991**, o `2^53 - 1`. Por encima no todos los enteros consecutivos tienen una representación exacta.

```ts
Number.MAX_SAFE_INTEGER; // 9007199254740991
9007199254740992 === 9007199254740993; // true
```

El segundo ejemplo muestra el problema: dos literales diferentes terminan representados igual. No significa que ningún número mayor sea representable; significa que ya no se pueden distinguir todos los enteros vecinos. [Referencia: entero seguro máximo](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER).

En PostgreSQL la columna es `bigint`, capaz de almacenar esos IDs. Según el registro del proyecto, 112 pacientes históricos superan el límite seguro de JavaScript. La solución se aplica antes de que el JSON llegue al navegador:

```ts
// Extracto de la selección del repositorio:
'id::text, nombre, sucursal, telefono'
```

La respuesta contiene el ID entre comillas y `Patient.id` es `string`. Los filtros `eq`, las rutas, los callbacks y el seguimiento de filas conservan esa cadena. No se usa `Number(id)`, `parseInt(id)` ni un paso intermedio numérico: convertir a texto después de perder dígitos no los recupera.

En Dart nativo estás acostumbrado a `int`; Flutter web también tiene restricciones propias del destino JavaScript. El modelo Angular expresa claramente que el ID no es una cantidad para sumar. Aunque existe `bigint` en JavaScript, utilizarlo exigiría adaptar JSON y el resto del flujo; para transportar identificadores aquí basta un string.

## 2. La base asigna los nuevos IDs con una secuencia

El alta Flutter consultada generaba un número aleatorio de 16 dígitos en el navegador. Dos clientes podían intentar usar el mismo identificador y el rango también podía superar la precisión de JavaScript.

El commit `93b30a4` cambia el contrato: la DB asigna el ID. La migración #5 crea `pacientes_id_seq`, la sitúa en el mayor ID existente más uno y la usa como valor por defecto. Con `setval(..., false)`, la próxima llamada devuelve exactamente el valor indicado.

El cliente omite ID y fecha de registro al insertar. El repositorio pide la fila creada y recibe el ID como texto. Los IDs históricos no se renumeran.

Una secuencia reparte valores distintos de manera atómica entre sesiones concurrentes. La llave primaria mantiene la restricción de unicidad en la tabla. No es un contador sin huecos: un intento fallido o una transacción revertida puede consumir un valor; el ID no debe usarse para contar pacientes ni como folio contable continuo. [Referencia: secuencias de PostgreSQL](https://www.postgresql.org/docs/current/functions-sequence.html).

La #5 usa el nombre antiguo `"ID PACIENTE"` porque corre antes de la #6, que lo renombra a `id`. Tras importar datos adicionales hay que revisar la posición de la secuencia con el nombre de columna que corresponda al estado del esquema. `last_value` no significa siempre «el próximo ID»: también interviene `is_called`; la verificación `max + 1` descrita en el transform corresponde a la inicialización con `false`, antes de consumir el siguiente valor.

## 3. date representa un día, no un instante

La migración #3 deja `fecha_registro` y `fecha_nacimiento` como `date`. El modelo recibe texto ISO `yyyy-MM-dd`, por ejemplo `2026-10-26`. Fecha de nacimiento admite `null`; fecha de registro es obligatoria y toma `current_date` por defecto en registros nuevos.

En Flutter se usaban cadenas de presentación como `dd-MMM-yyyy` o `dd-MM-yyyy`. Mezclar esas cadenas dificulta ordenar y comparar. Ahora la DB guarda un tipo de fecha y la vista decide cómo mostrarlo, como separar un valor de fecha de su `DateFormat`.

Una fecha de calendario no contiene hora ni zona horaria. Un `Date` de JavaScript, en cambio, representa un instante. Por eso no conviene convertir sin cuidado una cadena ISO a medianoche UTC y luego presentarla en hora local: en una zona negativa puede caer en el día anterior. El formulario mantiene `yyyy-MM-dd`; la vista previa separa año, mes y día para mostrar `dd/MM/yyyy`. [Referencia: tipos de fecha y hora](https://www.postgresql.org/docs/current/datatype-datetime.html).

La fecha que muestra el navegador como «hoy» y el `current_date` del servidor proceden de relojes/configuraciones distintos. La zona horaria de negocio debe quedar definida al ampliar la configuración por empresa; el tipo `date` elimina la hora del dato, no decide por sí solo qué día se considera hoy al crearlo.

## 4. Cómo se convierten las fechas heredadas

La migración #3 incorpora un parser temporal que admite día-mes-año con guion o barra y mes español abreviado con año de dos cifras. Acepta `sep` y `sept`. La regla de años es fija: 00–26 significa 2000–2026 y 27–99 significa 1927–1999.

Una fecha imposible o ilegible se convierte a `NULL`. La fecha de registro se toma de la columna de fecha existente y, si falta, se intenta recuperar del texto viejo. Si aún faltan registros, el `NOT NULL` falla deliberadamente para detectar el problema en el ensayo.

Los campos técnicos `created_at` y `updated_at` usan `timestamptz`, porque representan momentos concretos. Las filas históricas empiezan con esos valores nulos: no se inventa una hora de creación. Las nuevas reciben `created_at = now()` y un trigger actualiza `updated_at` al editar.

La normalización masiva de género y teléfonos desactiva temporalmente ese trigger dentro de sus migraciones para no presentar una corrección histórica como una edición del usuario.

## 5. Columnas limpias y teléfonos recuperados

La #6 aplica `snake_case`, sin espacios, mayúsculas ni tildes. El dueño eligió español para negocio e inglés para datos técnicos.

| Nombre anterior | Nombre nuevo |
|---|---|
| ID PACIENTE | id |
| NOMBRE COMPLETO | nombre |
| SUCURSAL | sucursal |
| TELEFONO CEL | telefono |
| TELEFONO 1 | telefono_secundario |
| GENERO | genero |
| OBSERVACIONES | observaciones |

La app conserva identificadores en inglés (`name`, `branch`, `secondaryPhone`) y el repositorio traduce con `toPatient` y `toColumns`. Es la separación que conoces entre modelo de aplicación y mapeo JSON en Dart.

La transformación de teléfonos usa el celular como principal; si falta, recupera el otro número. Si existen dos distintos conserva el segundo; si están repetidos deja solo el principal. El registro documenta 4,954 pacientes históricos cuyo único teléfono estaba en la columna que Flutter no mostraba. Son datos agregados del inventario, no un volcado de pacientes en esta entrega.

Se eliminan columnas verificadas como vacías en el inventario y una restricción UNIQUE redundante con la llave primaria. Antes del corte se debe repetir la comprobación de que siguen vacías: los datos de prod pueden haber cambiado desde la revisión.

La #4 normaliza género a Masculino, Femenino, Otro o NULL y agrega un `CHECK`. La interpretación H = Hombre y M = Mujer fue confirmada por el dueño. No se deduce de manera automática a partir de iniciales ambiguas.

## 6. Migración, transform y registro: tres piezas de una receta

Una migración es un archivo SQL versionado de `supabase/migrations/`: cambia estructura, restricciones, valores por defecto y, en estos casos, también transforma filas. Se parece a versionar las migraciones de una base local de Flutter, pero aquí se aplica a PostgreSQL compartido.

Un transform documenta cómo pasar de los datos viejos a los nuevos y cómo comprobarlo. En este repo los transforms #3–#6 son Markdown en `supabase/transforms/`: la conversión ejecutable está dentro del SQL. No hay que ejecutar dos veces la misma transformación suponiendo que cada carpeta contiene un script independiente.

`docs/db-changes.md` enlaza ambas piezas, explica el motivo y registra el ambiente de aplicación. Los cambios #3–#6 están documentados como aplicados en **dev (optinova-db)**; **prod (oftal-test-web)** conserva el esquema viejo hasta el corte. Los arreglos históricos #1 y #2 sí se aplicaron en ambos ambientes con autorización concreta del dueño.

| Cambio | Receta de migración en orden |
|---|---|
| #3, a7e6ae3 | Fechas date y columnas técnicas de tiempo |
| #4, 5135adf | Género normalizado y CHECK |
| #5, 93b30a4 | Secuencia para nuevos IDs |
| #6, e3ef363 | Columnas limpias y consolidación de teléfonos |

El orden importa porque una migración utiliza nombres que la siguiente renombra. Estos SQL no prometen ser reejecutables de forma arbitraria; el sistema registra qué migraciones se aplicaron.

## 7. Qué significa preparar el corte final

El proyecto necesita reimportar una copia fresca de prod porque varias tablas heredadas no tienen información suficiente para calcular todos los cambios incrementales. Sobre esa copia se aplicarán las migraciones pendientes en orden, con los controles de los transforms.

Entre las comprobaciones están conservar el total de pacientes, revisar fechas ilegibles, mantener teléfonos, conservar exactamente los IDs y colocar bien la secuencia. Esto se ensaya en dev antes de autorizar cualquier corte. Crear los documentos no ejecuta la restauración ni modifica prod.

Las siguientes relaciones deberán hacerse por ID: `revisiones.paciente_id` y las referencias de ventas. Esa decisión evita mezclar historiales de homónimos, pero la FK y la revisión de coincidencias ambiguas siguen pendientes al corte de esta lección.

Fuentes del proyecto: `docs/db-changes.md`, migraciones y transforms #3–#6; commits `a7e6ae3`, `5135adf`, `93b30a4`, `e3ef363`. Referencia Flutter: `add_patient_provider.dart` del repositorio original `7d3fa5f`.
