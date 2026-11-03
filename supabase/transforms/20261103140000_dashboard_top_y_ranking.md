# Transform #16: más vendido del mes y ranking de vendedores

Migración: `supabase/migrations/20261103140000_dashboard_top_y_ranking.sql`.

## Qué cambia en los datos

Nada. `create or replace` sobre `dashboard_summary(text, text, text)` (misma firma que en #13 a #15)
para agregar los bloques `top_products` y `seller_ranking`. No toca tablas ni filas: en el corte
(Fase 5) basta aplicar la migración después de la #15.

## Qué devuelven

Los dos miran el **mes en curso** (del día 1 a hoy en la hora de la empresa), sea cual sea el
periodo elegido en el dashboard, igual que `expenses_month`, y solo las ventas dentro del alcance
del rol (vendedor: las suyas y las de su cuenta; supervisor: su sucursal; admin y megadmin: todo,
con el filtro opcional de sucursal).

### `top_products`

Se arma con las líneas de armazón de `venta_items`:

- Una línea cuenta como armazón si trae **marca o modelo** (no se exige `id_montura`: hay ventas
  cuyo armazón no está en el inventario y quedan sin ese id).
- **Unidades:** salen de `montura_cantidad`, que es texto. Si es un entero positivo de hasta 4
  dígitos se usa; en cualquier otro caso vale 1, porque cada línea nueva es una unidad (el
  `CASE` evita castear texto basura). En PROD, las líneas históricas pueden traer otra cantidad.
- **Importe:** `montura_precio` por unidades.
- `brands`: las 5 marcas con más unidades. `models`: los 5 armazones (marca + modelo).
- Agrupa sin distinguir mayúsculas ni espacios en los bordes (`Ray-Ban` = `RAY-BAN`) y muestra la
  escritura más frecuente. Desempate: más importe, luego nombre.

### `seller_ranking`

Los 5 vendedores con más importe vendido en el mes, agrupados por `autor_nombre` (el vendedor a
cuyo nombre queda la venta, no quien tecleó). **Solo supervisor, admin y megadmin**: el vendedor
recibe `null`, igual que ingresos y egresos; ve lo suyo en "Mis ventas" con periodo Mes. Ventas
sin `autor_nombre` no cuentan.

## Pendiente conocido para el corte (Fase 5)

El ranking depende de que `autor_nombre` esté escrito de forma consistente. Se agrupa sin
distinguir mayúsculas, pero una persona escrita de dos formas distintas ("JORGE DIAZ" y "JORGE
DÍAZ") aparecería dos veces. Revisar en el ensayo de corte con los datos reales de PROD.

## Verificado en DEV (2026-11-03)

- Admin: marcas y total por marca iguales a una consulta directa sobre `venta_items` + `ventas`
  (Ray-Ban 4 unidades por S/. 6,500; TOMMY 2; GUESS 1).
- Admin: ranking de vendedores igual a la consulta directa sobre `ventas`, en el mismo orden.
- Vendedor: `seller_ranking` en `null`; el más vendido solo de sus ventas (vacío ese mes).
