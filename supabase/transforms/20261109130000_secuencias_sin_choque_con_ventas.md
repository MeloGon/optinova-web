# Transform #29: secuencias de resinas y armazones por encima de las líneas de venta

Migración: `supabase/migrations/20261109130000_secuencias_sin_choque_con_ventas.sql`. No cambia datos.

## Por qué (hallazgo de Antigravity, 2026-11-09)

Las resinas reales de PROD tienen ids al azar de 17 dígitos, pero `resinas_id_oftalmico_seq` estaba
en 4. Una resina nueva recibía el id 1, 2 o 3, que ya existen en `venta_items.id_oftalmico` de ventas
históricas (de otra resina que hoy no existe): `remove_resin` la tomaba por "ya vendida" y la
archivaba en lugar de borrarla, y cualquier consulta que cruce líneas con resinas habría mezclado
productos distintos. 24,027 de 24,075 líneas con resina apuntan a una resina que ya no existe.

## Qué hace

Pone cada secuencia en `mayor(max de la tabla, max de venta_items) + 1`, y nunca la baja:
- `resinas`: de 4 a 99,962,290,333,136,591.
- `armazones`: ya estaba arriba (#18); ahora también considera `venta_items.id_montura`.

## Verificado en DEV (2026-11-09)

Transacción revertida y luego aplicada: resinas 4 → 99962290333136591, armazones sin cambio, segunda
ejecución sin cambios. Los datos de prueba `AGY-RESINA` (ids 1 a 3) se borran en la limpieza final.
