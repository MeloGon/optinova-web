-- Permiso por vendedor para "cambiar fecha de venta", otorgado por su supervisor
-- (dentro de su propia sucursal) o por admin/megadmin (cualquier sucursal).
-- Reemplaza el enfoque de interruptor global único: ese se mantiene en
-- app_config como apagado de emergencia para toda la empresa (admin+),
-- y se le suma este permiso individual que debe estar ENCENDIDO además.

alter table public.perfiles
  add column puede_cambiar_fecha boolean not null default false;

comment on column public.perfiles.puede_cambiar_fecha is
  'Permiso individual (vendedor) para cambiar la fecha de una venta. Lo otorga su supervisor (misma sucursal) o admin/megadmin (cualquiera). Ver list_team_vendors/set_vendor_change_date_permission.';

-- Lista los vendedores que el que llama puede administrar:
-- supervisor -> solo los de su propia sucursal; admin/megadmin -> todos.
create or replace function public.list_team_vendors()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_branch text;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '28000';
  end if;

  select rol, sucursal into v_role, v_branch from public.perfiles where id = v_uid;

  if v_role is null then
    raise exception 'Perfil no encontrado' using errcode = '28000';
  end if;

  if v_role not in ('supervisor', 'admin', 'megadmin') then
    raise exception 'Requiere supervisor o superior' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id,
           'nombre', p.nombre,
           'sucursal', p.sucursal,
           'puedeCambiarFecha', p.puede_cambiar_fecha
         ) order by p.sucursal, p.nombre), '[]'::jsonb)
  into v_result
  from public.perfiles p
  where p.rol = 'vendedor'
    and (v_role in ('admin', 'megadmin') or p.sucursal = v_branch);

  return v_result;
end;
$$;

revoke all on function public.list_team_vendors() from public, anon;
grant execute on function public.list_team_vendors() to authenticated;

-- Otorga/quita el permiso a UN vendedor, validando alcance server-side
-- (nunca se confía en la sucursal que mande el cliente) y deja auditoría.
create or replace function public.set_vendor_change_date_permission(p_vendor_id uuid, p_value boolean)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_branch text;
  v_vendor_rol text;
  v_vendor_branch text;
  v_email text;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '28000';
  end if;

  select rol, sucursal into v_role, v_branch from public.perfiles where id = v_uid;

  if v_role not in ('supervisor', 'admin', 'megadmin') then
    raise exception 'Requiere supervisor o superior' using errcode = '42501';
  end if;

  select rol, sucursal into v_vendor_rol, v_vendor_branch from public.perfiles where id = p_vendor_id;

  if v_vendor_rol is null then
    raise exception 'Usuario no encontrado' using errcode = '28000';
  end if;

  if v_vendor_rol <> 'vendedor' then
    raise exception 'Solo se puede otorgar a vendedores' using errcode = '42501';
  end if;

  if v_role = 'supervisor' and v_vendor_branch <> v_branch then
    raise exception 'Solo puedes administrar vendedores de tu sucursal' using errcode = '42501';
  end if;

  update public.perfiles set puede_cambiar_fecha = p_value where id = p_vendor_id;

  select email into v_email from auth.users where id = v_uid;

  insert into public.audit_logs (action, entity, entity_id, user_email, detail)
  values (
    'set_change_date_permission',
    'perfiles',
    p_vendor_id::text,
    coalesce(v_email, v_uid::text),
    jsonb_build_object('value', p_value)
  );
end;
$$;

revoke all on function public.set_vendor_change_date_permission(uuid, boolean) from public, anon;
grant execute on function public.set_vendor_change_date_permission(uuid, boolean) to authenticated;
