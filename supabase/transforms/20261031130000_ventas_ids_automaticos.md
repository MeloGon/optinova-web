# Transform: ventas.id / ventas.folio / venta_items.id automáticos (cambio #10)

Solo agrega secuencias y defaults; ningún valor existente cambia.

## Verificación en PROD antes de aplicar (solo lectura)

```sql
select
  count(*) total,
  count(*) filter (where "ID REMISION" !~ '^[0-9]+$') id_no_numerico,
  min(length("ID REMISION")) id_len_min, max(length("ID REMISION")) id_len_max,
  count(*) filter (where "FOLIO REMISION" !~ '^[0-9]+$') folio_no_numerico,
  min(length("FOLIO REMISION")) folio_len_min, max(length("FOLIO REMISION")) folio_len_max,
  count(distinct "FOLIO REMISION") folios_distintos
from "ventas cortas";
-- 24,827 filas. id y folio: 0 valores no numéricos (ambos castean a bigint sin error).
-- folio: 17,872 distintos de 24,827 → choca en el 28% de las ventas (bug real de
-- generateRandomId sin chequeo de colisión). id no choca de milagro, mismo riesgo.
```

## Qué hace la migración

| Columna | Antes | Ahora |
|---|---|---|
| `ventas.id` (texto) | lo inventaba el navegador (`generateRandomId(17)`) | `default (nextval('ventas_id_seq'))::text`, secuencia arranca en `max(id::bigint) + 1` |
| `ventas.folio` (texto) | lo inventaba el navegador (`generateRandomId(6)`, sin chequeo de colisión) | `default (nextval('ventas_folio_seq'))::text`, secuencia arranca en `max(folio::bigint) + 1` |
| `venta_items.id` (bigint) | sin default, lo inventaba el navegador | `default nextval('venta_items_id_seq')`, secuencia arranca en `max(id) + 1` |

Las tres secuencias quedan `owned by` su columna (se borran solas si la columna
se borra algún día) y con `GRANT usage, select` a `authenticated`/`service_role`
(si no, Supabase rechaza el `nextval()` al insertar con sesión de usuario).

## Por qué ahora

`ventas`/`venta_items` ya tenían columnas limpias desde el cambio #8 (E2.5), pero
E2.5 solo leía ventas existentes; nunca insertaba una nueva. E2.6 (Vender) es la
primera feature que crea ventas, así que es el lugar natural para el mismo
arreglo que ya recibieron `pacientes.id` (#5) y `revisiones.id` (#7): seguía
pendiente desde que el cambio #5 lo anotó ("`ventas cortas`, `ventas` y
`revisiones` tendrán lo mismo con su entregable").

`venta_items.id` no tiene ninguna FK apuntando a su valor desde otra tabla
(a diferencia de `ventas.id`, que referencian `pagos.id_remision` y
`venta_items.venta_id`), así que convertirlo no tiene ningún riesgo de romper
un enlace existente.

## Pendiente

Al corte final (Fase 5), las `setval` de este archivo se vuelven a calcular
solas al reaplicar la migración sobre el dump fresco de PROD: no hace falta
tocar nada a mano.
