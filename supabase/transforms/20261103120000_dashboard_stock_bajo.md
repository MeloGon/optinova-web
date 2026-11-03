# Transform #15: stock bajo del dashboard

Migración: `supabase/migrations/20261103120000_dashboard_stock_bajo.sql`.

## Qué cambia en los datos

Nada. `create or replace` sobre `dashboard_summary(text, text, text)` (misma firma que en #13 y #14)
para agregar el bloque `low_stock`. No toca tablas ni filas: en el corte (Fase 5) basta aplicar la
migración después de la #14.

## Qué devuelve `low_stock`

Sobre el inventario de `armazones` con dato de existencias (las filas con `existencias` nulo no se
cuentan: no se sabe su stock). El inventario es por sucursal:

- vendedor y supervisor: el de su sucursal (el parámetro `p_branch` se ignora);
- admin y megadmin: el de toda la empresa, con el mismo filtro opcional de sucursal del resumen.

Campos:

- `count`: armazones con **1 o 2 unidades** (lo que conviene reponer).
- `out_count`: armazones **agotados** (0). Se cuentan pero no se listan.
- `items`: hasta 6 de los de `count`, los de menos stock primero y luego por marca y modelo.

### Por qué los agotados no se listan

En el inventario real muchos modelos en 0 están descontinuados: listarlos llenaría el bloque de
ruido y taparía lo accionable. Si el dueño quiere verlos, basta cambiar `between 1 and 2` por
`<= 2` en el CTE `low` y ajustar el rótulo; el resto no cambia. El umbral (2) está fijo en la
función; si hace falta por empresa, pasa a `app_config` en la Fase 4b.

## Verificado en DEV (2026-11-03)

- Admin, todas las sucursales: 7 con 1 o 2 unidades y 11 agotados, igual que la consulta directa
  sobre `armazones`; la lista trae 6.
- Admin con filtro MEDILENT: 4 y 5, igual que la consulta directa.
- Vendedor de MEDILENT pidiendo `OFTALVISION`: recibe 4 y 5 de su propia sucursal.
