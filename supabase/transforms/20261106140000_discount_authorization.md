# Transform #24: autorización de descuentos por sucursal (P-04 en Vender)

Migración: `supabase/migrations/20261106140000_discount_authorization.sql`.
Edge Function: `supabase/functions/authorize-discount/index.ts`.

## Qué cambia en los datos

Nada de lo existente. Solo se agregan:

- Tabla `sucursal_config` (vacía). Una sucursal sin fila usa el valor por defecto: **descuento
  libre** para el vendedor. Las sucursales siguen siendo texto; en la Fase 4b la clave pasará a
  `sucursal_id`.
- Tabla `descuento_autorizaciones` (vacía, sin políticas ni grants para `authenticated`).
- Columna `ventas.descuento_autorizado_por` (`NULL` en las ventas históricas).

En el corte (Fase 5) basta aplicar la migración y desplegar el Edge Function; no hay datos que
transformar. Las ventas importadas de PROD entran sin sesión de usuario (`auth.uid()` nulo), así que
el trigger las deja pasar tal cual.

## Reglas que hace cumplir el servidor

- Supervisor, admin y megadmin descuentan directo siempre.
- Vendedor con la regla apagada en su sucursal (o en la de la venta): descuenta directo.
- Vendedor con la regla encendida: la venta solo se guarda si hay una autorización vigente (10
  minutos), sin usar y de un monto mayor o igual al descuento. El trigger la consume (un solo uso)
  y guarda quién autorizó en `ventas.descuento_autorizado_por`.
- Un vendedor no puede cambiar el `descuento` de una venta ya registrada (UPDATE).
- Quien autoriza: supervisor de la **misma sucursal** que el vendedor, o admin/megadmin.
- Cambiar el interruptor: `set_branch_discount_auth(sucursal, valor)`; el supervisor solo en su
  sucursal, admin/megadmin en cualquiera. Cada cambio y cada autorización quedan en `audit_logs`
  (`set_branch_discount_auth`, `authorize_discount`).

## Verificación en DEV

Trigger probado en una transacción revertida con el vendedor de prueba (8 casos) y flujo completo
con curl y los usuarios reales del seed (11 casos): activar la regla, rechazo sin autorización,
contraseña incorrecta, el vendedor intentando autorizarse a sí mismo, autorización válida, reuso de
la autorización, supervisor de otra sucursal, y descuento libre con la regla apagada. Los datos de
prueba se borraron al terminar.
