-- Cambio #25: endurecimiento a partir de los advisors de Supabase (seguridad y rendimiento).
--
-- 1) Permisos de funciones: `audit_logs_stats()` quedó ejecutable por `anon` (le faltó el REVOKE
--    en #17) y las funciones de trigger no deben ser invocables por RPC por nadie.
-- 2) `search_path` fijo en las 3 funciones que no lo tenían.
-- 3) Índices en llaves foráneas sin cobertura (el importante: venta_items.venta_id, que se consulta
--    cada vez que se abre el detalle de una venta).
-- 4) Políticas RLS con `(select auth.uid())`, para que se evalúe una vez y no por fila.
-- 5) Índice duplicado de `vendedores`.
-- No cambia datos ni el comportamiento visible de la app.

-- 1) Permisos -------------------------------------------------------------------------------------
revoke all on function public.audit_logs_stats() from public, anon;
grant execute on function public.audit_logs_stats() to authenticated;

revoke all on function public.audit_log_payment() from public, anon, authenticated;
revoke all on function public.audit_log_sale() from public, anon, authenticated;
revoke all on function public.audit_log_sale_date() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- 2) search_path ----------------------------------------------------------------------------------
alter function public.audit_actor_email() set search_path = public, auth, pg_temp;
alter function public.jwt_role() set search_path = public, auth, pg_temp;
alter function public.handle_new_user() set search_path = public, pg_temp;

-- 3) Índices de llaves foráneas -------------------------------------------------------------------
create index if not exists venta_items_venta_id_idx on public.venta_items (venta_id);
create index if not exists pagos_registrado_por_idx on public.pagos (registrado_por);
create index if not exists egresos_categoria_id_idx on public.egresos (categoria_id);
create index if not exists ventas_descuento_autorizado_por_idx on public.ventas (descuento_autorizado_por);
create index if not exists pacientes_archivado_por_idx on public.pacientes (archivado_por);
create index if not exists descuento_autorizaciones_autorizado_por_idx
  on public.descuento_autorizaciones (autorizado_por);

-- 4) RLS: auth.uid() una sola vez por consulta ----------------------------------------------------
drop policy if exists "own profile read" on public.perfiles;
create policy "own profile read" on public.perfiles
  for select to public
  using (id = (select auth.uid()));

drop policy if exists "admin can update app_config" on public.app_config;
create policy "admin can update app_config" on public.app_config
  for update to authenticated
  using (
    exists (
      select 1 from public.perfiles
      where id = (select auth.uid()) and rol in ('admin', 'megadmin')
    )
  );

-- 5) Índice duplicado -----------------------------------------------------------------------------
-- `vendedores_id_key` y `vendedores_pkey` son idénticos (UNIQUE sobre id); se queda la llave primaria.
alter table public.vendedores drop constraint if exists vendedores_id_key;
