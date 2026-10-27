# Transform #7: columnas de `revisiones` y FK a `pacientes`

Como en los anteriores, la conversión vive **dentro** de la migración `20261026230000_revisiones_columnas_fk.sql`. En el corte (Fase 5) se restaura PROD (esquema viejo) y se aplican las migraciones en orden; esta debe correr **después** de los cambios de `pacientes` (#3 a #6), porque enlaza por nombre, sucursal y fecha de registro.

## Nombres

| Origen (PROD) | Destino |
|---|---|
| `"ID REFRACCION"` | `id` |
| `"PACIENTE"` | `paciente_nombre` (respaldo; ya no es la forma de enlazar) |
| `"FECHA"` (texto, se elimina) | — |
| `fecha_revision_actualizada` | `fecha` |
| `"MOTIVO DE CONSULTA"` | `motivo_consulta` |
| `"HISTORIA CLINICA"` | `historia_clinica` |
| `"OD/OI ESF"`, `"OD/OI CIL"`, `"OD/OI EJE"`, `"OD/OI AV"` | `od_esf`, `od_cil`, `od_eje`, `od_av`, `oi_esf`, `oi_cil`, `oi_eje`, `oi_av` |
| `"ADD"` | `adicion` |
| `"OBSERVACIONES"` | `observaciones` |
| `"DIP"` | `dip` |
| `"SUCURSAL"` | `sucursal` |
| `"OD/OI CB LC"`, `"OD/OI DIAM LC"` | `od_cb_lc`, `od_diam_lc`, `oi_cb_lc`, `oi_diam_lc` |
| `"TIPO DE GRADUACION"` | `tipo_graduacion` |
| `"AV SIN RX OD/OI LEJOS"` | `av_sin_rx_od_lejos`, `av_sin_rx_oi_lejos` |
| `"CV OD/OI LEJOS"` | `cv_od_lejos`, `cv_oi_lejos` |
| `"AV SIN RX OD/OI CERCA"` | `av_sin_rx_od_cerca`, `av_sin_rx_oi_cerca` |
| `"AV CON RX OD/OI CERCA"` | `av_con_rx_od_cerca`, `av_con_rx_oi_cerca` |
| `"DIAGNOSTICO OPTOMETRICO"` | `diagnostico_optometrico` |

Nuevo: `paciente_id` (FK a `pacientes.id`), `created_at`, `updated_at` (trigger, reutiliza `public.set_updated_at()` del cambio #3).

## Por qué `fecha` viene de `fecha_revision_actualizada` y no de `"FECHA"`

`"FECHA"` es un texto en español con formato variable (`dd-MMM-yyyy`, ej. `30-nov-2025`), pensado solo para mostrarse — convertirlo exigiría el mismo parser de meses en español que ya se escribió para `pacientes` (cambio #3). `fecha_revision_actualizada` ya es `date` y, verificado en DEV (50 filas) y en PROD (17,331 filas) el 2026-10-26, está llena en el 100% de los casos. Se renombra a `fecha` y se vuelve `NOT NULL`.

## Cómo se rellena `paciente_id` (decisión del dueño, 2026-10-26)

Dos pasadas, ambas por nombre exacto sin distinguir mayúsculas (`lower(btrim(...))`):

1. **Nombre único.** La revisión tiene exactamente un paciente con ese nombre en `pacientes` → se enlaza directo.
2. **Nombre repetido.** Se filtra por: misma `sucursal` **y** el paciente ya estaba registrado (`fecha_registro <= fecha` de la revisión). Si con ese filtro queda un solo candidato, se enlaza. Si siguen siendo varios, o ninguno, o la revisión no tiene nombre, `paciente_id` queda `NULL`.

Las filas que quedan sin enlazar (ambiguas, sin paciente en la tabla, o sin nombre en la revisión) se identifican para revisión manual con:

```sql
select count(*) filter (where btrim(coalesce(paciente_nombre, '')) = '') as sin_nombre,
       count(*) filter (where btrim(coalesce(paciente_nombre, '')) <> '' and paciente_id is null) as sin_enlazar
from public.revisiones;
```

### Estimación sobre PROD (17,331 filas, 2026-10-26)

No se aplicó todavía sobre PROD (esta migración corre sobre DEV); la cifra es la que motivó la decisión del dueño:

| Resultado | Filas aprox. |
|---|---|
| Enlazadas por nombre único | ~16,503 |
| Enlazadas por sucursal + fecha de registro | ~357 |
| Pendientes: nombre ambiguo tras el filtro | ~366 |
| Pendientes: sin paciente con ese nombre | ~42 |
| Pendientes: sin nombre en la revisión | ~62 |

El corte (Fase 5) vuelve a correr esta migración sobre una copia fresca de PROD y repite el conteo de `sin_enlazar` antes de dar por bueno el resultado.

## Verificación del ensayo de corte

Antes de la migración, sobre la copia de PROD:

```sql
select count(*) as total, count("FECHA") as con_fecha_texto, count(fecha_revision_actualizada) as con_fecha_date
from public.revisiones;
```

`con_fecha_date` debe ser igual a `total` (si no, hay filas que perderían la fecha).

Después:

```sql
select count(*) as total,
       count(paciente_id) as enlazadas,
       count(*) filter (where paciente_id is null and btrim(coalesce(paciente_nombre, '')) <> '') as pendientes_con_nombre,
       count(*) filter (where btrim(coalesce(paciente_nombre, '')) = '') as sin_nombre
from public.revisiones;
```

`enlazadas + pendientes_con_nombre + sin_nombre` debe ser igual a `total`.
