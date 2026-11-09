-- Cambio #33: multi-empresa, paso 2a. RLS por organización en las tablas del negocio.
--
-- Hasta hoy todas tenían `USING (true)` para cualquier usuario con sesión. Ahora cada usuario solo ve
-- y escribe filas de su organización; `megadmin` (dueño de la plataforma) ve todas. El alcance por
-- sucursal sigue en las RPC y en la app (paso 2b).
--
-- `organizacion_id` deja de tener DEFAULT fijo en las tablas del negocio: un trigger lo completa con
-- la organización del usuario con sesión (`mi_organizacion()`), así una segunda empresa no cae en la
-- primera. Se mantiene el DEFAULT en `perfiles` hasta el paso 2c (`handle_new_user` y la Edge Function
-- crean perfiles sin sesión de usuario).
--
-- `venta_items` no tiene organización propia: hereda la de su venta. `venta_items_huerfanos` y
-- `pacientes_unidos` siguen sin políticas (solo service role).
--
-- Re-ejecutable.

create or replace function public.mi_organizacion()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organizacion_id from public.perfiles where id = (select auth.uid())
$$;

create or replace function public.es_megadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select rol = 'megadmin' from public.perfiles where id = (select auth.uid())), false)
$$;

revoke execute on function public.mi_organizacion() from public, anon;
revoke execute on function public.es_megadmin() from public, anon;
grant execute on function public.mi_organizacion() to authenticated;
grant execute on function public.es_megadmin() to authenticated;

-- Completa organizacion_id con la del usuario con sesión cuando la fila no la trae.
create or replace function public.set_organizacion_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.organizacion_id is null then
    new.organizacion_id := public.mi_organizacion();
  end if;
  return new;
end;
$$;

revoke execute on function public.set_organizacion_id() from public, anon, authenticated;

do $$
declare
  v_tabla text;
  v_pol   record;
  tablas  text[] := array['pacientes', 'revisiones', 'ventas', 'pagos', 'egresos',
                          'categorias_egresos', 'armazones', 'resinas', 'vendedores'];
begin
  foreach v_tabla in array tablas loop
    execute format('alter table public.%I alter column organizacion_id drop default', v_tabla);

    execute format('drop trigger if exists trg_set_organizacion_id on public.%I', v_tabla);
    execute format(
      'create trigger trg_set_organizacion_id before insert on public.%I '
      'for each row execute function public.set_organizacion_id()', v_tabla);

    -- Quita las políticas abiertas anteriores (cualquier nombre) y deja una sola por organización.
    for v_pol in select policyname from pg_policies where schemaname = 'public' and tablename = v_tabla loop
      execute format('drop policy %I on public.%I', v_pol.policyname, v_tabla);
    end loop;

    execute format('alter table public.%I enable row level security', v_tabla);
    execute format(
      'create policy "por organizacion" on public.%I for all to authenticated '
      'using (organizacion_id = (select public.mi_organizacion()) or (select public.es_megadmin())) '
      'with check (organizacion_id = (select public.mi_organizacion()) or (select public.es_megadmin()))',
      v_tabla);
  end loop;
end
$$;

-- venta_items hereda la organización de su venta.
do $$
declare v_pol record;
begin
  for v_pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'venta_items' loop
    execute format('drop policy %I on public.venta_items', v_pol.policyname);
  end loop;
end
$$;

create policy "por organizacion de la venta" on public.venta_items
  for all to authenticated
  using (exists (
    select 1 from public.ventas v
    where v.id = venta_items.venta_id
      and (v.organizacion_id = (select public.mi_organizacion()) or (select public.es_megadmin()))
  ))
  with check (exists (
    select 1 from public.ventas v
    where v.id = venta_items.venta_id
      and (v.organizacion_id = (select public.mi_organizacion()) or (select public.es_megadmin()))
  ));
