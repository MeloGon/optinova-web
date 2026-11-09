-- Cambio #32: multi-empresa, paso 1 (expandir). Organizaciones y sucursales como datos.
--
-- Hasta hoy una sucursal era un texto repetido en cada fila (`ventas.sucursal = 'MEDILENT'`) y la
-- lista vivía fija en el front. Aquí se crean `organizaciones` (la empresa cliente) y `sucursales`
-- (cada una pertenece a una organización), y se agregan `organizacion_id` y `sucursal_id` a las
-- tablas del negocio.
--
-- Es ADITIVA: el texto `sucursal` se queda y la app actual (y Flutter mientras viva) sigue
-- funcionando igual. Un trigger mantiene `sucursal_id` al día cuando solo se escribe el texto.
-- Las RPC, las políticas RLS por organización y la pantalla de sucursales son el paso 2.
--
-- Datos actuales: una organización, "Inversiones Oftalvision", con OFTALVISION y MEDILENT activas
-- y OFTALMIC CENTER cerrada (tiene historial). `organizacion_id` tiene por DEFAULT esa organización
-- mientras exista una sola empresa; el paso 2 lo reemplaza por la organización del usuario con sesión.
--
-- Sin sucursal (texto vacío o null: 1,343 revisiones, 8 egresos, 329 armazones) queda `sucursal_id`
-- en null: no se inventa el dato.
--
-- Re-ejecutable.

create table if not exists public.organizaciones (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.sucursales (
  id              bigint generated always as identity primary key,
  organizacion_id uuid not null references public.organizaciones(id),
  nombre          text not null,
  activa          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (organizacion_id, nombre)
);

create index if not exists sucursales_organizacion_id_idx on public.sucursales(organizacion_id);

insert into public.organizaciones (nombre) values ('Inversiones Oftalvision')
on conflict (nombre) do nothing;

insert into public.sucursales (organizacion_id, nombre, activa)
select o.id, s.nombre, s.activa
from public.organizaciones o
cross join (values ('OFTALVISION', true), ('MEDILENT', true), ('OFTALMIC CENTER', false)) as s(nombre, activa)
where o.nombre = 'Inversiones Oftalvision'
on conflict (organizacion_id, nombre) do nothing;

-- Función que completa `sucursal_id` a partir del texto `sucursal` y de `organizacion_id`.
create or replace function public.sync_sucursal_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if btrim(coalesce(new.sucursal, '')) = '' then
    new.sucursal_id := null;
  else
    select s.id into new.sucursal_id
    from public.sucursales s
    where s.organizacion_id = new.organizacion_id
      and s.nombre = btrim(new.sucursal);
  end if;
  return new;
end;
$$;

revoke execute on function public.sync_sucursal_id() from public, anon, authenticated;

do $$
declare
  v_org   uuid;
  v_tabla text;
  -- tablas con organización y sucursal
  con_sucursal text[] := array['pacientes', 'revisiones', 'ventas', 'egresos', 'armazones', 'perfiles'];
  -- tablas con organización solamente
  solo_org text[] := array['pagos', 'resinas', 'vendedores', 'categorias_egresos'];
begin
  select id into v_org from public.organizaciones where nombre = 'Inversiones Oftalvision';

  foreach v_tabla in array con_sucursal || solo_org loop
    execute format('alter table public.%I add column if not exists organizacion_id uuid references public.organizaciones(id)', v_tabla);
    -- Es una corrección de datos: no debe disparar auditoría, reglas de descuento ni updated_at.
    execute format('alter table public.%I disable trigger user', v_tabla);
    execute format('update public.%I set organizacion_id = %L where organizacion_id is null', v_tabla, v_org);
    execute format('alter table public.%I alter column organizacion_id set default %L', v_tabla, v_org);
    execute format('alter table public.%I alter column organizacion_id set not null', v_tabla);
    execute format('create index if not exists %I on public.%I(organizacion_id)', v_tabla || '_organizacion_id_idx', v_tabla);
    execute format('alter table public.%I enable trigger user', v_tabla);
  end loop;

  foreach v_tabla in array con_sucursal loop
    execute format('alter table public.%I add column if not exists sucursal_id bigint references public.sucursales(id)', v_tabla);
    execute format('alter table public.%I disable trigger user', v_tabla);
    execute format(
      'update public.%I t set sucursal_id = s.id from public.sucursales s '
      'where s.organizacion_id = t.organizacion_id and s.nombre = btrim(t.sucursal) and t.sucursal_id is null',
      v_tabla);
    execute format('alter table public.%I enable trigger user', v_tabla);
    execute format('create index if not exists %I on public.%I(sucursal_id)', v_tabla || '_sucursal_id_idx', v_tabla);
    execute format('drop trigger if exists trg_sync_sucursal_id on public.%I', v_tabla);
    execute format(
      'create trigger trg_sync_sucursal_id before insert or update of sucursal, organizacion_id on public.%I '
      'for each row execute function public.sync_sucursal_id()',
      v_tabla);
  end loop;
end
$$;

-- Lectura: cada usuario ve las sucursales de su organización; megadmin ve todas. Sin escritura directa
-- (el paso 2 agrega las funciones para crear y editar sucursales).
alter table public.organizaciones enable row level security;
alter table public.sucursales enable row level security;

revoke all on public.organizaciones from public, anon, authenticated;
revoke all on public.sucursales from public, anon, authenticated;
grant select on public.organizaciones to authenticated;
grant select on public.sucursales to authenticated;

drop policy if exists "ver mi organizacion" on public.organizaciones;
create policy "ver mi organizacion" on public.organizaciones
  for select to authenticated
  using (
    exists (
      select 1 from public.perfiles p
      where p.id = (select auth.uid())
        and (p.rol = 'megadmin' or p.organizacion_id = organizaciones.id)
    )
  );

drop policy if exists "ver sucursales de mi organizacion" on public.sucursales;
create policy "ver sucursales de mi organizacion" on public.sucursales
  for select to authenticated
  using (
    exists (
      select 1 from public.perfiles p
      where p.id = (select auth.uid())
        and (p.rol = 'megadmin' or p.organizacion_id = sucursales.organizacion_id)
    )
  );
