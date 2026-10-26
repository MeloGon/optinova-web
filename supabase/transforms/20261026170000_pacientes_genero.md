# Transform #4: género de `pacientes`

Como en el #3, la conversión vive dentro de la migración `20261026170000_pacientes_genero_normalizado.sql`.

## Reglas de conversión

| Origen (PROD) | Destino | Pacientes en PROD (2026-10-26) |
|---|---|---|
| `H`, `Masculino` | `Masculino` | 4,818 + 471 |
| `M`, `Femenino` | `Femenino` | 5,933 + 582 |
| `Otro` | `Otro` | 0 |
| vacío, NULL o cualquier otro texto | NULL (sin especificar) | 3,455 |

`H` = Hombre y `M` = Mujer, confirmado por el dueño. El campo queda con un `CHECK`: solo acepta los tres valores o NULL.

## Verificación del ensayo de corte

Antes de la migración, sobre la copia de PROD:

```sql
select coalesce("GENERO", '(null)') as valor, count(*) from public.pacientes group by 1 order by 2 desc;
```

Después:

```sql
select coalesce("GENERO", '(null)') as valor, count(*) from public.pacientes group by 1 order by 2 desc;
```

Esperado: `Masculino` = H + Masculino, `Femenino` = M + Femenino y `(null)` = vacíos + cualquier valor desconocido. Si `(null)` crece más de lo esperado, hay valores que el `CASE` no conoce: revisarlos antes de seguir.
