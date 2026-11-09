-- Cambio #36: multi-empresa, paso 2d. Funciones para crear y administrar sucursales y empresas.
--
-- `sucursales` y `organizaciones` siguen sin escritura directa: todo pasa por estas funciones, que
-- validan quién llama.
--   crear_sucursal(nombre, organizacion?)       admin (su empresa) o megadmin (cualquiera)
--   editar_sucursal(id, nombre?, activa?)       admin (su empresa) o megadmin (cualquiera)
--   crear_organizacion(nombre, sucursal)        solo megadmin; siembra su configuración
--
-- Renombrar una sucursal actualiza también el texto `sucursal` de pacientes, revisiones, ventas,
-- egresos, armazones, perfiles y sucursal_config de esa empresa (el texto se mantiene junto a
-- `sucursal_id` hasta que el front deje de usarlo). Es una corrección de datos: durante el cambio se
-- apagan los triggers de usuario de las tablas grandes para no mover `updated_at` ni disparar reglas.
-- Todo ocurre en una transacción; si algo falla, no queda nada a medias.
--
-- Cerrar una sucursal no borra nada (`activa = false`). No se puede cerrar la última abierta de una
-- empresa. Los nombres se guardan en mayúsculas, sin espacios repetidos.
--
-- Re-ejecutable.

create or replace function public._nombre_sucursal(p_nombre text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare v text := upper(btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g')));
begin
  if v = '' then
    raise exception 'El nombre es obligatorio' using errcode = '22023';
  end if;
  if length(v) > 60 then
    raise exception 'El nombre no puede pasar de 60 caracteres' using errcode = '22023';
  end if;
  return v;
end;
$$;

revoke execute on function public._nombre_sucursal(text) from public, anon, authenticated;

create or replace function public.crear_sucursal(p_nombre text, p_organizacion uuid default null)
returns bigint
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_rol   text;
  v_mi    uuid;
  v_org   uuid;
  v_nom   text := public._nombre_sucursal(p_nombre);
  v_id    bigint;
  v_email text;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '28000';
  end if;
  select rol, organizacion_id into v_rol, v_mi from public.perfiles where id = v_uid;
  if v_rol not in ('admin', 'megadmin') then
    raise exception 'Requiere admin o superior' using errcode = '42501';
  end if;

  v_org := coalesce(p_organizacion, v_mi);
  if v_rol = 'admin' and v_org is distinct from v_mi then
    raise exception 'Solo puedes administrar tu empresa' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizaciones where id = v_org) then
    raise exception 'Empresa no encontrada' using errcode = '22023';
  end if;
  if exists (select 1 from public.sucursales where organizacion_id = v_org and nombre = v_nom) then
    raise exception 'Ya existe una sucursal con ese nombre' using errcode = '23505';
  end if;

  insert into public.sucursales (organizacion_id, nombre) values (v_org, v_nom) returning id into v_id;

  select email into v_email from auth.users where id = v_uid;
  insert into public.audit_logs (action, entity, entity_id, user_email, detail, organizacion_id)
  values ('create_branch', 'sucursales', v_id::text, coalesce(v_email, v_uid::text),
          jsonb_build_object('nombre', v_nom), v_org);
  return v_id;
end;
$$;

create or replace function public.editar_sucursal(
  p_id bigint,
  p_nombre text default null,
  p_activa boolean default null
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_rol     text;
  v_mi      uuid;
  v_suc     public.sucursales%rowtype;
  v_nuevo   text;
  v_email   text;
  v_detalle jsonb := '{}'::jsonb;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '28000';
  end if;
  select rol, organizacion_id into v_rol, v_mi from public.perfiles where id = v_uid;
  if v_rol not in ('admin', 'megadmin') then
    raise exception 'Requiere admin o superior' using errcode = '42501';
  end if;

  select * into v_suc from public.sucursales where id = p_id for update;
  -- Si es de otra empresa se responde igual que si no existiera.
  if not found or (v_rol = 'admin' and v_suc.organizacion_id is distinct from v_mi) then
    raise exception 'Sucursal no encontrada' using errcode = '22023';
  end if;

  if p_activa is not null and p_activa is distinct from v_suc.activa then
    if p_activa = false and not exists (
      select 1 from public.sucursales
      where organizacion_id = v_suc.organizacion_id and activa and id <> v_suc.id
    ) then
      raise exception 'La empresa debe tener al menos una sucursal abierta' using errcode = '22023';
    end if;
    update public.sucursales set activa = p_activa where id = v_suc.id;
    v_detalle := v_detalle || jsonb_build_object('activa', p_activa);
  end if;

  if p_nombre is not null then
    v_nuevo := public._nombre_sucursal(p_nombre);
    if v_nuevo <> v_suc.nombre then
      if exists (select 1 from public.sucursales
                 where organizacion_id = v_suc.organizacion_id and nombre = v_nuevo) then
        raise exception 'Ya existe una sucursal con ese nombre' using errcode = '23505';
      end if;

      alter table public.pacientes disable trigger user;
      alter table public.revisiones disable trigger user;
      alter table public.ventas disable trigger user;

      update public.sucursales set nombre = v_nuevo where id = v_suc.id;
      update public.pacientes  set sucursal = v_nuevo where organizacion_id = v_suc.organizacion_id and sucursal = v_suc.nombre;
      update public.revisiones set sucursal = v_nuevo where organizacion_id = v_suc.organizacion_id and sucursal = v_suc.nombre;
      update public.ventas     set sucursal = v_nuevo where organizacion_id = v_suc.organizacion_id and sucursal = v_suc.nombre;
      update public.egresos    set sucursal = v_nuevo where organizacion_id = v_suc.organizacion_id and sucursal = v_suc.nombre;
      update public.armazones  set sucursal = v_nuevo where organizacion_id = v_suc.organizacion_id and sucursal = v_suc.nombre;
      update public.perfiles   set sucursal = v_nuevo where organizacion_id = v_suc.organizacion_id and sucursal = v_suc.nombre;
      update public.sucursal_config set sucursal = v_nuevo where organizacion_id = v_suc.organizacion_id and sucursal = v_suc.nombre;

      alter table public.pacientes enable trigger user;
      alter table public.revisiones enable trigger user;
      alter table public.ventas enable trigger user;

      v_detalle := v_detalle || jsonb_build_object('nombre_anterior', v_suc.nombre, 'nombre', v_nuevo);
    end if;
  end if;

  if v_detalle <> '{}'::jsonb then
    select email into v_email from auth.users where id = v_uid;
    insert into public.audit_logs (action, entity, entity_id, user_email, detail, organizacion_id)
    values ('update_branch', 'sucursales', v_suc.id::text, coalesce(v_email, v_uid::text),
            v_detalle, v_suc.organizacion_id);
  end if;
end;
$$;

create or replace function public.crear_organizacion(p_nombre text, p_sucursal text)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_nom   text := btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  v_suc   text := public._nombre_sucursal(p_sucursal);
  v_org   uuid;
  v_email text;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '28000';
  end if;
  if not public.es_megadmin() then
    raise exception 'Requiere megadmin' using errcode = '42501';
  end if;
  if v_nom = '' or length(v_nom) > 100 then
    raise exception 'El nombre de la empresa es obligatorio (máximo 100 caracteres)' using errcode = '22023';
  end if;
  if exists (select 1 from public.organizaciones where lower(nombre) = lower(v_nom)) then
    raise exception 'Ya existe una empresa con ese nombre' using errcode = '23505';
  end if;

  insert into public.organizaciones (nombre) values (v_nom) returning id into v_org;
  insert into public.sucursales (organizacion_id, nombre) values (v_org, v_suc);

  -- Configuración inicial: lo que el front espera encontrar en cada empresa.
  insert into public.app_config (organizacion_id, key, value, description) values
    (v_org, 'feature_change_date', 'true', 'Permite cambiar la fecha de una venta desde el historial');

  select email into v_email from auth.users where id = v_uid;
  insert into public.audit_logs (action, entity, entity_id, user_email, detail, organizacion_id)
  values ('create_organization', 'organizaciones', v_org::text, coalesce(v_email, v_uid::text),
          jsonb_build_object('nombre', v_nom, 'sucursal', v_suc), v_org);
  return v_org;
end;
$$;

revoke execute on function public.crear_sucursal(text, uuid) from public, anon;
revoke execute on function public.editar_sucursal(bigint, text, boolean) from public, anon;
revoke execute on function public.crear_organizacion(text, text) from public, anon;
grant execute on function public.crear_sucursal(text, uuid) to authenticated;
grant execute on function public.editar_sucursal(bigint, text, boolean) to authenticated;
grant execute on function public.crear_organizacion(text, text) to authenticated;
