# Transform #12: `ventas.creado_por` y funciones del Dashboard

Migración: `supabase/migrations/20261102210000_dashboard_y_creado_por.sql`.

## Qué cambia en los datos

Nada. Solo se agrega la columna `ventas.creado_por` (uuid, FK a `perfiles`, `ON DELETE SET NULL`).

## Al reimportar PROD en el corte (Fase 5)

- Las ventas de PROD no tienen quién las registró: **`creado_por` queda `NULL`**. El import corre sin sesión de usuario (`auth.uid()` es nulo), así que el trigger `trg_ventas_creado_por` respeta el valor recibido y no inventa uno.
- **`autor_nombre` no se toca.** Es el vendedor a cuyo nombre quedó la venta, y puede ser distinto de quien tecleó. En PROD es la única referencia al vendedor.
- Para "mis ventas" del Dashboard, las ventas históricas se atribuyen por `autor_nombre` = `perfiles.nombre` (sin distinguir mayúsculas ni espacios en los bordes). Las ventas nuevas usan además `creado_por`.
- Regla del dashboard (decisión del dueño, 2026-11-02): un vendedor puede prestar su cuenta para que otro registre una venta a nombre del segundo. La lista de ventas recientes y el saldo por cobrar del vendedor incluyen lo que salió de su cuenta (`creado_por`) **y** lo que quedó a su nombre (`autor_nombre`). El KPI "mis ventas hoy" cuenta solo lo que quedó a su nombre, para que una venta prestada no infle su total. Para que el segundo vendedor la vea, el nombre de su perfil debe coincidir con el vendedor elegido en el selector.
- `audit_logs` históricos conservan `user_email` (quién tecleó); no llevan `vendedor` ni `creado_por` en `detail` (solo los `create_sale` nuevos).
- Orden: aplicar después de #8 (renombre a `ventas`) y #10 (secuencias).

## Verificado en DEV (2026-11-02)

- Un vendedor que inserta una venta mandando `creado_por` de otro usuario: la base lo reemplaza por el suyo.
- El log `create_sale` guarda `user_email`, `vendedor`, `creado_por` y `creado_por_nombre`.
- `dashboard_summary`: vendedor ve solo lo suyo y recibe `null` en ingresos, métodos de pago y egresos; supervisor ignora `p_branch` y usa su sucursal; admin ve todo.
- `dashboard_activity`: vendedor recibe `42501`; `anon` no puede ejecutar ninguna de las dos funciones.
