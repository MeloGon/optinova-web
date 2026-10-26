# Transform #6: columnas de `pacientes`

Como en los anteriores, la conversión vive **dentro** de la migración `20261026210000_pacientes_columnas_limpias.sql`. En el corte (Fase 5) se restaura PROD (esquema viejo) y se aplican las migraciones en orden.

## Nombres

| Origen (PROD) | Destino |
|---|---|
| `"ID PACIENTE"` | `id` |
| `"NOMBRE COMPLETO"` | `nombre` |
| `"SUCURSAL"` | `sucursal` |
| `"TELEFONO CEL"` | `telefono` |
| `"TELEFONO 1"` | `telefono_secundario` |
| `"GENERO"` | `genero` |
| `"OBSERVACIONES"` | `observaciones` |
| `"COLONIA O LOCALIDAD"` | `colonia` |
| `"DEL O MPIO"` | `municipio` |
| `"NUMERO DE EMPLEADO"` | `numero_empleado` |
| `"HIPERSENSIBILIDAD A LA LUZ"` | `hipersensibilidad_luz` |
| `"USA DISPOSITIVOS"` | `usa_dispositivos` |
| `"DOMICILIO"`, `"EMAIL"`, `"EMPRESA"`, `"IDENTIFICACION"`, `"PERSONALIZADO 1"` | en minúsculas |

## Teléfonos (datos de PROD, 2026-10-26)

| Situación | Pacientes | Resultado |
|---|---|---|
| Solo `TELEFONO CEL` | 6,411 | `telefono` = celular |
| Solo `TELEFONO 1` | 4,954 | `telefono` = ese número (antes la app no lo mostraba) |
| Ambos distintos | 202 | `telefono` = celular, `telefono_secundario` = el otro |
| Ambos iguales | 1 | `telefono` = celular, `telefono_secundario` vacío |
| Ninguno | 3,691 | ambos vacíos |

## Columnas eliminadas (vacías en los 15,259 pacientes de PROD)

`"ENTIDAD FEDERATIVA"`, `"OCUPACION"`, `"PERSONALIZADO 2"`, `"PERSONALIZADO 3"`, `"PERSONALIZADO 4"`, `"PERSONALIZADO 5"`. Además se elimina la restricción `UNIQUE` repetida sobre el ID (la llave primaria ya la cubre).

## Verificación del ensayo de corte

Antes de la migración, sobre la copia de PROD:

```sql
select count(*) as total,
       count(*) filter (where btrim(coalesce("TELEFONO CEL", '')) <> '' or btrim(coalesce("TELEFONO 1", '')) <> '') as con_algun_telefono
from public.pacientes;
```

Después:

```sql
select count(*) as total,
       count(*) filter (where btrim(coalesce(telefono, '')) <> '') as con_telefono,
       count(*) filter (where btrim(coalesce(telefono_secundario, '')) <> '') as con_secundario
from public.pacientes;
```

`total` debe coincidir, `con_telefono` debe ser igual al `con_algun_telefono` de antes, y `con_secundario` debe rondar 202.

Antes de eliminar las columnas vacías, confirmar sobre la copia que siguen vacías:

```sql
select count(*) filter (where btrim(coalesce("ENTIDAD FEDERATIVA", '')) <> '') as entidad,
       count(*) filter (where btrim(coalesce("OCUPACION", '')) <> '') as ocupacion,
       count(*) filter (where btrim(coalesce("PERSONALIZADO 2", '') || coalesce("PERSONALIZADO 3", '') || coalesce("PERSONALIZADO 4", '') || coalesce("PERSONALIZADO 5", '')) <> '') as personalizados
from public.pacientes;
```

Los tres deben dar 0; si no, esos datos se perderían al migrar.
