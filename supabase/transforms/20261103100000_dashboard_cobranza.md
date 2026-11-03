# Transform #14: cobranza del dashboard

Migración: `supabase/migrations/20261103100000_dashboard_cobranza.sql`.

## Qué cambia en los datos

Nada. `create or replace` sobre `dashboard_summary(text, text, text)` (misma firma que en #13) para
agregar el bloque `collections`. No toca tablas ni filas: en el corte (Fase 5) basta aplicar la
migración después de la #13.

## Qué devuelve `collections`

Ventas con saldo (`resta > 0`) dentro del alcance del rol (el mismo de las ventas del resumen:
vendedor, sus ventas y las de su cuenta; supervisor, su sucursal; admin y megadmin, todo con filtro
opcional de sucursal). Es una foto de hoy: no depende del periodo.

- `total` y `count`: suma y cantidad. `total` es igual a `kpis.receivable`.
- `buckets`: siempre tres, por antigüedad de la venta contra hoy en la hora de la empresa:
  `recent` (0 a 7 días), `mid` (8 a 30) y `old` (31 o más). Una venta **sin fecha** cuenta como
  `old`: no se sabe cuánto lleva pendiente y es más seguro que se vea.
- `top`: las 5 ventas con mayor saldo (desempate: la más antigua), con todas las columnas que
  necesita "Registrar abono" (`id`, `folio`, `date`, `branch`, `patient_id`, `patient`, `seller`,
  `total`, `discount`, `total_with_discount`, `account`, `rest`) y `age_days`.

`kpis.receivable` pasa a calcularse desde el mismo conjunto de ventas con saldo.

## Verificado en DEV (2026-11-03)

- Admin: 60 ventas con saldo y S/. 118,259, igual que la suma directa sobre `ventas`; tramos 12, 10
  y 38 ventas, también iguales a la consulta directa.
- Vendedor de prueba (sin saldos propios): ceros en los tres tramos y `top` vacío.
