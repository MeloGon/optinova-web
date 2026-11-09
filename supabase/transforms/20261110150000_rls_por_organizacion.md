# Transform #33: RLS por organización (multi-empresa, paso 2a)

Migración: `supabase/migrations/20261110150000_rls_por_organizacion.sql`. Corre después de la #32.
Aprobada por el dueño el 2026-11-09 (`megadmin` ve todas las empresas; `admin` solo la suya).

## Qué hace

- Funciones `mi_organizacion()` y `es_megadmin()` (`SECURITY DEFINER`, leen `perfiles` con `auth.uid()`; ejecutables solo por `authenticated`).
- Trigger `trg_set_organizacion_id` (antes de insertar): si la fila no trae `organizacion_id`, usa el del usuario con sesión.
  El DEFAULT fijo de la #32 se quita en esas tablas.
- Una sola política `"por organizacion"` (todas las operaciones, `USING` y `WITH CHECK`) en `pacientes`, `revisiones`, `ventas`,
  `pagos`, `egresos`, `categorias_egresos`, `armazones`, `resinas` y `vendedores`: ven y escriben solo su organización; `megadmin` todas.
  Reemplaza las políticas `USING (true)` anteriores.
- `venta_items` hereda la organización de su venta.

## No toca (paso 2b/2c)

`perfiles` (conserva su DEFAULT: `handle_new_user` y la Edge Function crean perfiles sin sesión), `audit_logs` (aún sin organización;
todas las empresas verían la auditoría de las demás), `app_config`, `sucursal_config`, `descuento_autorizaciones`, y las RPC
`SECURITY DEFINER` (saltan RLS: se limitan por organización en el paso 2b).

## Prueba (transacción revertida, DEV 2026-11-09)

Segunda empresa "Otra Optica" con su admin: ve 0 pacientes, 0 ventas y 0 líneas; su paciente nuevo queda en su organización; insertar
con la organización de Oftalvision se bloquea (`42501`). El supervisor de Oftalvision ve 15 299 pacientes y ninguno de la otra empresa;
`megadmin` ve todos. El supervisor sigue pudiendo leer ventas/líneas/pagos, dar de alta pacientes y egresos y editar pacientes.
