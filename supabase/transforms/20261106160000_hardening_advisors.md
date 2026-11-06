# Transform #25: endurecimiento a partir de los advisors de Supabase

Migración: `supabase/migrations/20261106160000_hardening_advisors.sql`.

## Qué cambia en los datos

Nada. Solo permisos de funciones, `search_path`, índices, dos políticas RLS reescritas y un índice
duplicado eliminado. En el corte (Fase 5) basta aplicarla después de la #24.

## Qué cambia

- `audit_logs_stats()` deja de ser ejecutable por `anon` (a #17 le faltó el `REVOKE`). Las cuatro
  funciones de trigger (`audit_log_payment`, `audit_log_sale`, `audit_log_sale_date`,
  `handle_new_user`) pierden el `EXECUTE` de todos los roles: los triggers siguen disparándose
  porque Postgres solo comprueba ese permiso al crearlos.
- `search_path` fijo en `audit_actor_email`, `jwt_role` y `handle_new_user`.
- Índices en llaves foráneas: `venta_items.venta_id` (el relevante: cada detalle de venta),
  `pagos.registrado_por`, `egresos.categoria_id`, `ventas.descuento_autorizado_por`,
  `pacientes.archivado_por` y `descuento_autorizaciones.autorizado_por`.
- Políticas `perfiles."own profile read"` y `app_config."admin can update app_config"` usan
  `(select auth.uid())`: se evalúa una vez por consulta y no por fila. Misma lógica que antes.
- Se elimina `vendedores_id_key`, duplicado exacto de `vendedores_pkey`.

## Verificación en DEV

Advisors antes y después: desaparecen los avisos de `anon`, de `search_path`, de `auth_rls_initplan`
y del índice duplicado. Recorrido con los 4 usuarios reales: perfil propio, `app_config`,
`dashboard_summary`, `audit_logs_stats` y `venta_items` siguen respondiendo 200; `anon` recibe 401
en `audit_logs_stats`; el supervisor sigue sin poder escribir `app_config` y el admin sí.

## Queda a propósito

- `multiple_permissive_policies` en `perfiles`: la política `"admin all perfiles"` usa `jwt_role()`,
  que lee `app_metadata.role`, un dato que ningún usuario tiene. Resolverla implica decidir dónde
  vive el rol; va con la Fase 4.
- `authenticated_security_definer_function_executable`: las RPC de reportes y permisos son
  `SECURITY DEFINER` a propósito y comprueban rol y sucursal con `auth.uid()` por dentro.
- `rls_enabled_no_policy` en `descuento_autorizaciones`: intencional, solo la escribe el service role.
- `unused_index`: los índices nuevos y `ventas_sucursal_idx` aparecen sin uso porque DEV tiene pocos
  datos y poco tráfico; se revisan con volumen real.
- `auth_leaked_password_protection`: es un interruptor del dashboard de Supabase (Auth), no de SQL.
