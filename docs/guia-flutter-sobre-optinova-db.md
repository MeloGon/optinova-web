# Guía: llevar los cambios de optinova-db a la app Flutter

Qué habría que cambiar en `oftal_web` (Flutter, commit `7d3fa5f`) para que funcione sobre `optinova-db` con las migraciones #1 a #37, o para que tenga las mismas mejoras que Angular.

- Fecha: 2026-11-23.
- Qué cambió y por qué: `docs/mejoras-vs-flutter.md`. Detalle técnico de cada migración: `docs/db-changes.md`.

## 0. Antes de empezar: ¿vale la pena?

**Flutter no es compatible sin adaptación con `optinova-db`.** Muchas consultas y modelos usan nombres anteriores (`"ventas cortas"`, `"ID PACIENTE"`, `"NOMBRE COMPLETO"`...). Algunas funciones podrían seguir funcionando, pero conectar toda la app sin revisar no garantiza su funcionamiento.

**Tamaño del trabajo.** La carpeta `lib/core/data/datasources/remote/` tiene 11 archivos en el commit de referencia. Hay que revisar sus consultas, los modelos (`fromJson` / `toJson`) y varias pantallas; el alcance exacto depende de la opción elegida.

Opciones, de menos a más trabajo:

| Opción | Qué implica | Cuándo conviene |
|---|---|---|
| A. No portar | Flutter se queda sobre PROD viejo, en solo lectura, como archivo histórico. Angular es el único sistema que escribe | Posible respaldo; decisión del dueño pendiente |
| B. Portar solo lectura | Flutter lee de `optinova-db` (consultas y fichas) sin escribir | Si alguien necesita la app Flutter para consultar |
| C. Portar todo | Flutter lee y escribe en `optinova-db` con las mismas reglas que Angular | Solo si Flutter debe seguir vivo en paralelo a largo plazo |

Si las dos apps escriben a la vez, habrá que mantener ambas interfaces y asegurar que consuman las mismas reglas de negocio. La base protege gran parte (RLS, triggers, funciones), pero las pantallas no.

## 1. Cambios necesarios para las funciones afectadas

### 1.1 Tablas renombradas

| Flutter usa | En optinova-db |
|---|---|
| `from('ventas cortas')` (el encabezado o remisión) | `from('ventas')` |
| `from('ventas')` (las líneas, al revés de lo esperado) | `from('venta_items')` |

Es el cambio más delicado: el nombre `ventas` existe en las dos bases, pero significa otra cosa. Hay que revisar todas las consultas de ambas tablas y sus modelos.

### 1.2 Columnas renombradas

Las tablas de pacientes, revisiones, ventas y catálogo tuvieron cambios de columnas. Equivalencias principales; no todas las columnas de toda la base cambiaron:

**pacientes**

| Antes | Ahora |
|---|---|
| `ID PACIENTE` | `id` (lo genera la base) |
| `NOMBRE COMPLETO` | `nombre` |
| `SUCURSAL` | `sucursal` (texto) y `sucursal_id` |
| `FECHA DE REGISTRO` (texto) / `fecha_registro_actualizada` | `fecha_registro` (`date`) |
| `FECHA DE NACIMIENTO` (texto) | `fecha_nacimiento` (`date`) |
| `TELEFONO CEL` / `TELEFONO 1` | `telefono` / `telefono_secundario` |
| `COLONIA O LOCALIDAD` / `DEL O MPIO` | `colonia` / `municipio` |
| `NUMERO DE EMPLEADO` | `numero_empleado` |
| `PERSONALIZADO 1` | `personalizado_1` |
| `USA DISPOSITIVOS` / `HIPERSENSIBILIDAD A LA LUZ` | `usa_dispositivos` / `hipersensibilidad_luz` |
| `GENERO` (`H`, `M`, ...) | `genero`: solo `Masculino`, `Femenino`, `Otro` o null |
| `ENTIDAD FEDERATIVA`, `OCUPACION`, `PERSONALIZADO 2` a `5` | Eliminadas (estaban vacías) |

**revisiones**

| Antes | Ahora |
|---|---|
| `ID REFRACCION` | `id` (lo genera la base) |
| `PACIENTE` | `paciente_nombre` y, nuevo, `paciente_id` (obligatorio en revisiones nuevas) |
| `FECHA` (texto) / `fecha_revision_actualizada` | `fecha` (`date`, obligatoria) |
| `MOTIVO DE CONSULTA`, `HISTORIA CLINICA` | `motivo_consulta`, `historia_clinica` |
| `OD ESF`, `OI CIL`, `ADD`... | `od_esf`, `oi_cil`, `adicion`... |
| `TIPO DE GRADUACION`, `DIAGNOSTICO OPTOMETRICO` | `tipo_graduacion`, `diagnostico_optometrico` |
| `AV SIN RX OD LEJOS`... | `av_sin_rx_od_lejos`... |

**ventas (antes `"ventas cortas"`)**

| Antes | Ahora |
|---|---|
| `ID REMISION` | `id` (lo genera la base) |
| `FOLIO REMISION` | `folio` (lo genera la base) |
| `ID PACIENTE` | `paciente_id` (FK real) y `paciente_id_legado` (respaldo) |
| `PACIENTE` | `paciente_nombre` |
| `AUTOR NOMBRE` / `AUTOR APELLIDOS` | `autor_nombre` / `autor_apellidos` |
| `TOTAL`, `DESCUENTO`, `TOTAL CON DESCUENTO` | `total`, `descuento`, `total_con_descuento` |
| `A CUENTA`, `RESTA` | `a_cuenta`, `resta` |
| `MOTIVO DEL DESCUENTO`, `NUMERO DE PARCIALIDADES` | `motivo_descuento`, `numero_parcialidades` |
| `MONTO DEL DESCUENTO VIA NOMINA` | `monto_descuento_nomina` |
| `FECHA` | `fecha_legado` |
| `fecha_actualizada`, `fecha_venta_iso` | Igual |

**venta_items (antes `"ventas"`)**

| Antes | Ahora |
|---|---|
| `ID` | `id` |
| `ID REMISION` | `venta_id` (FK a `ventas.id`, borra en cascada) |
| `FOLIO DE VENTA` | `folio_venta` |
| `FECHA DE VENTA` | `fecha_venta_legado` |
| `PACIENTE` | `paciente_nombre` |
| `ID OFTALMICO`, `DISEÑO`, `ID MONTURA`, `MONTURA CANTIDAD`... | `id_oftalmico`, `diseno`, `id_montura`, `montura_cantidad`... |

**armazones**

| Antes | Ahora |
|---|---|
| `ID ARMAZON` | `id` (lo genera la base) |
| `MARCA`, `MODELO`, `COLOR`, `DESCRIPCION`, `PRECIO` | En minúsculas |
| `CODIGO DE BARRAS` | `codigo_barras` |
| `EXISTENCIAS` | `existencias` (nunca negativo) |
| `NOMBRE DE LA OPTICA` | `sucursal` y `sucursal_id` |
| `FECHA DE REGISTRO` | `fecha_registro_legado` |
| `CREADO EL` | `creado_el` |
| `Expr1010`, `PROVEEDOR`, `CONSIGNACION` | Eliminadas |

**resinas:** `diseño` pasa a `diseno` y `CREADO EL` a `creado_el`. El resto se queda igual.
**vendedores:** `NOMBRE` pasa a `nombre`.
**pagos, egresos, categorias_egresos:** mismos nombres. Ganan `organizacion_id`, que llena un trigger.

### 1.3 IDs y folios: dejar de inventarlos

Flutter genera en el cliente los IDs de pacientes, revisiones, ventas, líneas y armazones, y el folio de venta. Ahora los genera la base con secuencias.

- **Qué cambiar:** quitar esos campos de los `toJson()` de inserción y leer el id devuelto con `.insert(...).select()`.
- **Por qué:** si Flutter manda su número al azar, puede chocar con la secuencia o volver a generar folios repetidos.
- **Ojo con los IDs grandes:** hay IDs viejos de 17 dígitos. En Flutter web los enteros que superan el máximo seguro de JavaScript (2^53 − 1) pueden perder precisión; la cantidad de dígitos por sí sola no determina si un valor es seguro. Angular los lee como texto (`id::text`). En Flutter web conviene hacer lo mismo y tratarlos como `String`.

### 1.4 Fechas

`pacientes.fecha_registro`, `pacientes.fecha_nacimiento` y `revisiones.fecha` ahora son `date`, en formato `YYYY-MM-DD`. Hay que borrar el parseo de textos en español ("12 de marzo de 2024") y mandar y leer fechas ISO.

### 1.5 Permisos que ya no tiene el navegador

| Acción en Flutter | Qué pasa ahora | Qué hacer |
|---|---|---|
| `pacientes.delete()` | Prohibido (no hay permiso `DELETE`) | Llamar a la Edge Function `patients-lifecycle` (`resolve`, luego `apply`; `restore` para desarchivar) |
| `pacientes.update()` de columnas fuera de las 7 editables | Rechazado | Editar solo `nombre`, `telefono`, etc. Archivar va por la Edge Function |
| `armazones.delete()` / `resinas.delete()` de un producto ya vendido | Rechazado por trigger | Usar las RPC `remove_mount(id)` / `remove_resin(id)`, que archivan si ya se vendió |
| `app_config.update()` siendo vendedor o supervisor | 0 filas, sin error | Solo admin y megadmin |
| `perfiles.update()` | Prohibido | La gestión de usuarios va por la Edge Function `megadmin-users` |

### 1.6 Cada usuario ve solo su empresa

Las tablas del negocio filtran por `organizacion_id` con RLS. Flutter no tiene que mandar `organizacion_id`: lo llena un trigger con la empresa del usuario. Hay que saber que:
- Un usuario sin `organizacion_id` no obtiene el alcance de una organización normal; revisar excepciones de megadmin y políticas por tabla.
- Megadmin ve todas las empresas. Si Flutter no filtra, mezclará datos de varias.

## 2. Cambios en la lógica de ventas (recomendados)

### 2.1 Crear una venta: una sola llamada

Flutter hoy (`sale_remote_datasource.dart`):
1. inserta las líneas en `"ventas"`;
2. inserta el encabezado en `"ventas cortas"`;
3. resta stock armazón por armazón (`decrementStock`, una unidad por llamada);
4. inserta el pago.

Si algo falla a mitad, la venta queda rota. Ahora se usa la RPC `create_sale`, que hace todo en una transacción:

```dart
final result = await client.rpc('create_sale', params: {
  'p_sale': {...},     // encabezado: paciente, vendedor, sucursal, descuento...
  'p_items': [...],    // líneas: resinas y armazones con su cantidad
  'p_payment': {...},  // pago inicial, o null
});
// El contenido exacto de cada jsonb es el que arma Angular en
// src/app/core/data/supabase-sale.repository.ts
```

Con la RPC, el servidor recalcula el total desde las líneas, valida descuento, monto a cuenta y stock, resta la cantidad real y registra el pago inicial. Además, un trigger rechaza ventas nuevas sin líneas, así que el flujo actual de Flutter (líneas primero, encabezado después) puede fallar.

### 2.2 Abonos

Reemplazar el insert en `pagos` más el update de `resta` y `a_cuenta` por la RPC `register_payment`. Bloquea la venta, impide abonar más que el saldo y actualiza todo junto.

### 2.3 Eliminar una venta

Flutter borraba el encabezado y las líneas por separado. Una revisión previa identificó 191 líneas huérfanas y relacionó parte de ellas con un error de borrado; el ensayo más reciente contó 197. Ahora `venta_items.venta_id` borra en cascada: basta borrar la venta. `pagos` tiene `ON DELETE RESTRICT`: una venta con pagos no puede borrarse mientras esos pagos sigan referenciándola. La política de negocio debe decidir qué operaciones se permiten; no se recomienda borrar pagos automáticamente.

### 2.4 Descuentos con autorización

Si una sucursal tiene encendida la regla (`sucursal_config.descuento_requiere_autorizacion`), una venta con descuento de un vendedor necesita una autorización vigente. Se pide con la Edge Function `authorize-discount` (correo y contraseña del supervisor). Sin eso, el servidor rechaza la venta con el error `42501`. Hoy la regla está apagada en todas las sucursales.

### 2.5 Cambiar fecha de venta

En la interfaz Angular se combinan el interruptor `feature_change_date` y, para vendedor, `perfiles.puede_cambiar_fecha`. La aplicación de estas condiciones a actualizaciones directas de ventas en servidor está pendiente de verificación; ver el hallazgo en `docs/status.md`.

## 3. Mejoras opcionales (para igualar a Angular)

| Mejora | Cómo se obtiene en Flutter |
|---|---|
| Dashboard con alcance por rol | RPC `dashboard_summary(p_branch, p_tz, p_period)` y `dashboard_activity(p_limit)` |
| Reporte de pagos con alcance en el servidor | RPC `payments_report(p_from, p_to, p_branch)` |
| Ventas por vendedor sin traer el mes completo | RPC `sales_by_seller_summary` y `sales_by_seller_detail` |
| Permisos de cambiar fecha por vendedor | RPC `list_team_vendors()` y `set_vendor_change_date_permission(id, valor)` |
| Regla de descuentos por sucursal | RPC `set_branch_discount_auth(sucursal, valor)` |
| Sucursales desde la base | Leer `sucursales` (`activa = true` en los formularios de alta) en vez de la lista fija del código |
| Administrar sucursales y empresas | RPC `crear_sucursal`, `editar_sucursal`, `crear_organizacion` |
| Ficha del paciente | Leer `revisiones` y `ventas` por `paciente_id` (ya no por nombre) |
| Teléfono secundario | Mostrar `telefono_secundario` |
| Ocultar archivados | Filtrar `archivado_en is null` en pacientes, armazones y resinas |

## 4. Orden sugerido si se decide portar (opción B o C)

1. Hacer una rama en `oftal_web` y apuntarla a un proyecto Supabase de pruebas, **nunca** a la base real.
2. Modelos y datasources de lectura: pacientes, revisiones, ventas y venta_items, armazones, resinas.
3. Fechas e IDs como texto.
4. Para opción C: escrituras simples de pacientes (sin borrar), egresos y categorías. Para opción B, detenerse en lectura y pruebas.
5. Ventas y abonos con `create_sale` y `register_payment`.
6. Borrados con las Edge Functions y RPC.
7. Prueba completa por rol contra la copia, igual que hizo Antigravity con Angular.

## 5. Referencias en este repo

Repositorios: `src/app/core/data/`; migraciones: `supabase/migrations/`; Edge Functions: `supabase/functions/`.
