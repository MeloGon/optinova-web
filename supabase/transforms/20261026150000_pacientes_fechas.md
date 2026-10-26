# Transform #3: fechas de `pacientes`

La conversión de datos vive **dentro** de la migración `20261026150000_pacientes_fechas_date.sql`: la migración convierte las filas al cambiar las columnas. Por eso, en el corte (Fase 5) basta restaurar PROD en `optinova-db` (esquema viejo) y aplicar las migraciones en orden.

## Reglas de conversión

| Origen (PROD) | Destino | Regla |
|---|---|---|
| `fecha_registro_actualizada` (date) | `fecha_registro` (date, NOT NULL) | se renombra; si fuera nula se intenta con `"FECHA DE REGISTRO"` |
| `"FECHA DE NACIMIENTO"` (text) | `fecha_nacimiento` (date, NULL) | `dd-mm-aaaa` o `dd/mm/aaaa`; `dd-mmm-aa` con mes en español (`sept` = septiembre); vacío o ilegible = NULL |
| `"FECHA DE REGISTRO"` (text) | (se elimina) | era una copia en texto de `fecha_registro` |
| (no existía) | `created_at`, `updated_at` (timestamptz) | quedan en NULL para las filas importadas: no se inventa una hora que no se guardó. `created_at` toma `now()` en filas nuevas; `updated_at` lo pone el trigger en cada UPDATE |

Año de 2 cifras: `00`-`26` = 20xx, `27`-`99` = 19xx.

## Verificación del ensayo de corte

Sobre la copia de PROD, antes de la migración, anotar:

```sql
select count(*) as total,
       count(*) filter (where btrim(coalesce("FECHA DE NACIMIENTO",'')) <> '') as con_nacimiento
from public.pacientes;
```

Después de la migración:

```sql
select count(*) as total,
       count(fecha_nacimiento) as con_nacimiento,
       count(*) filter (where fecha_registro is null) as sin_registro -- debe ser 0
from public.pacientes;
```

`total` debe coincidir y `con_nacimiento` no debe ser menor que el de antes (cualquier diferencia son textos ilegibles: revisar).
