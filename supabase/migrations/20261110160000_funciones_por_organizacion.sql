-- Cambio #34: multi-empresa, paso 2b. Auditoría, configuración y RPC por organización.
--
-- La #33 aisló las tablas del negocio. Faltaban tres cosas que se saltaban ese aislamiento:
--
-- 1. `audit_logs`, `app_config` y `sucursal_config` no tenían organización: una segunda empresa habría
--    visto la auditoría y los interruptores de Oftalvision. Ahora cada una pertenece a una organización.
-- 2. Las RPC `SECURITY DEFINER` de reportes corren con permisos de sistema y no pasan por RLS. Las que
--    solo leen tablas ya aisladas (`dashboard_summary`, `dashboard_activity`, `sales_by_seller_*`,
--    `audit_logs_stats`) pasan a `SECURITY INVOKER`: desde ahora la RLS decide qué ven, igual que en el
--    resto de la app. Sin cambiar su lógica ni su alcance por rol y sucursal.
-- 3. Las que necesitan permisos de sistema (leen perfiles de otros usuarios) filtran por organización a
--    mano: `payments_report`, `list_team_vendors`, `set_vendor_change_date_permission`,
--    `set_branch_discount_auth`, y el trigger `enforce_venta_descuento`.
--
-- Un supervisor o vendedor sigue limitado a su sucursal; un `admin` ahora solo ve su empresa. `megadmin`
-- ve todas las empresas en los reportes. Los interruptores de `app_config` y `sucursal_config` son de la
-- organización del usuario, también para `megadmin` (cambia los de su propia empresa).
--
-- Re-ejecutable.

-- ============================================================ audit_logs

alter table public.audit_logs add column if not exists organizacion_id uuid references public.organizaciones(id);
create index if not exists audit_logs_organizacion_id_idx on public.audit_logs(organizacion_id);

alter table public.audit_logs disable trigger user;
update public.audit_logs
set organizacion_id = (select id from public.organizaciones where nombre = 'Inversiones Oftalvision')
where organizacion_id is null;
alter table public.audit_logs enable trigger user;

drop trigger if exists trg_set_organizacion_id on public.audit_logs;
create trigger trg_set_organizacion_id before insert on public.audit_logs
  for each row execute function public.set_organizacion_id();

drop policy if exists "authenticated can insert audit_logs" on public.audit_logs;
drop policy if exists "authenticated can read audit_logs" on public.audit_logs;
drop policy if exists "por organizacion" on public.audit_logs;
create policy "por organizacion" on public.audit_logs for all to authenticated
  using (organizacion_id = (select public.mi_organizacion()) or (select public.es_megadmin()))
  with check (organizacion_id = (select public.mi_organizacion()) or (select public.es_megadmin()));

-- ============================================================ app_config

alter table public.app_config add column if not exists organizacion_id uuid references public.organizaciones(id);
update public.app_config
set organizacion_id = (select id from public.organizaciones where nombre = 'Inversiones Oftalvision')
where organizacion_id is null;
alter table public.app_config alter column organizacion_id set not null;

alter table public.app_config drop constraint if exists app_config_pkey;
alter table public.app_config add primary key (organizacion_id, key);

drop trigger if exists trg_set_organizacion_id on public.app_config;
create trigger trg_set_organizacion_id before insert on public.app_config
  for each row execute function public.set_organizacion_id();

drop policy if exists "admin can update app_config" on public.app_config;
drop policy if exists "authenticated can read app_config" on public.app_config;
drop policy if exists "leer config de mi organizacion" on public.app_config;
drop policy if exists "admin actualiza config de su organizacion" on public.app_config;

create policy "leer config de mi organizacion" on public.app_config for select to authenticated
  using (organizacion_id = (select public.mi_organizacion()));

create policy "admin actualiza config de su organizacion" on public.app_config for update to authenticated
  using (
    organizacion_id = (select public.mi_organizacion())
    and exists (select 1 from public.perfiles where id = (select auth.uid()) and rol in ('admin', 'megadmin'))
  )
  with check (organizacion_id = (select public.mi_organizacion()));

-- ============================================================ sucursal_config

alter table public.sucursal_config add column if not exists organizacion_id uuid references public.organizaciones(id);
update public.sucursal_config
set organizacion_id = (select id from public.organizaciones where nombre = 'Inversiones Oftalvision')
where organizacion_id is null;
alter table public.sucursal_config alter column organizacion_id set not null;

alter table public.sucursal_config drop constraint if exists sucursal_config_pkey;
alter table public.sucursal_config add primary key (organizacion_id, sucursal);

drop policy if exists "authenticated can read sucursal_config" on public.sucursal_config;
drop policy if exists "leer config de sucursales de mi organizacion" on public.sucursal_config;
create policy "leer config de sucursales de mi organizacion" on public.sucursal_config for select to authenticated
  using (organizacion_id = (select public.mi_organizacion()));

-- ============================================================ RPC que pasan a SECURITY INVOKER

alter function public.dashboard_summary(text, text, text) security invoker;
alter function public.dashboard_activity(integer) security invoker;
alter function public.sales_by_seller_summary(date, date, text) security invoker;
alter function public.sales_by_seller_detail(date, date, text, text, integer, integer) security invoker;
alter function public.audit_logs_stats() security invoker;

-- ============================================================ RPC con filtro de organización a mano

create or replace function public.payments_report(p_from date, p_to date, p_branch text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $$
declare
  v_uid    uuid := auth.uid();
  v_role   text;
  v_branch text;
  v_org    uuid;
  v_filter text;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '28000';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Rango de fechas inválido' using errcode = '22023';
  end if;

  select rol, sucursal, organizacion_id into v_role, v_branch, v_org from public.perfiles where id = v_uid;
  if v_role is null then
    raise exception 'Perfil no encontrado' using errcode = '28000';
  end if;
  if v_role = 'vendedor' then
    raise exception 'Requiere supervisor o superior' using errcode = '42501';
  end if;

  -- supervisor: siempre su propia sucursal, sin importar lo que mande el cliente.
  -- admin/megadmin: la que pidan, o todas si no mandan ninguna.
  v_filter := case v_role when 'supervisor' then v_branch else nullif(btrim(p_branch), '') end;

  select jsonb_build_object(
    'branch', v_filter,
    'payments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id,
        'sale_id', p.id_remision,
        'amount', p.monto,
        'date', p.fecha_pago,
        'payment_method', p.metodo_pago,
        'notes', p.notas,
        'type', coalesce(p.tipo_pago, 'abono_saldo'),
        'registered_by', pr.nombre,
        'patient_name', s.paciente_nombre,
        'folio', s.folio,
        'branch', s.sucursal,
        'sale_total', s.total_con_descuento,
        'sale_rest', s.resta
      ) order by p.fecha_pago desc), '[]'::jsonb)
      from public.pagos p
      join public.ventas s on s.id = p.id_remision
      left join public.perfiles pr on pr.id = p.registrado_por
      where p.fecha_pago between p_from and p_to
        and (v_filter is null or s.sucursal = v_filter)
        and (v_role = 'megadmin' or s.organizacion_id = v_org)
    ),
    'expenses', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id,
        'date', e.fecha,
        'category_id', e.categoria_id,
        'category_name', c.nombre,
        'category_color', c.color,
        'description', e.descripcion,
        'amount', e.monto,
        'payment_method', e.metodo_pago,
        'receipt', e.comprobante,
        'branch', e.sucursal,
        'registered_by', e.registrado_por,
        'notes', e.notas
      ) order by e.fecha desc), '[]'::jsonb)
      from public.egresos e
      left join public.categorias_egresos c on c.id = e.categoria_id
      where e.fecha between p_from and p_to
        and (v_filter is null or e.sucursal = v_filter)
        and (v_role = 'megadmin' or e.organizacion_id = v_org)
    )
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.list_team_vendors()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_branch text;
  v_org uuid;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '28000';
  end if;

  select rol, sucursal, organizacion_id into v_role, v_branch, v_org from public.perfiles where id = v_uid;

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
    and (v_role = 'megadmin' or p.organizacion_id = v_org)
    and (v_role in ('admin', 'megadmin') or p.sucursal = v_branch);

  return v_result;
end;
$$;

create or replace function public.set_vendor_change_date_permission(p_vendor_id uuid, p_value boolean)
returns void
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_branch text;
  v_org uuid;
  v_vendor_rol text;
  v_vendor_branch text;
  v_vendor_org uuid;
  v_email text;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '28000';
  end if;

  select rol, sucursal, organizacion_id into v_role, v_branch, v_org from public.perfiles where id = v_uid;

  if v_role not in ('supervisor', 'admin', 'megadmin') then
    raise exception 'Requiere supervisor o superior' using errcode = '42501';
  end if;

  select rol, sucursal, organizacion_id into v_vendor_rol, v_vendor_branch, v_vendor_org
  from public.perfiles where id = p_vendor_id;

  if v_vendor_rol is null then
    raise exception 'Usuario no encontrado' using errcode = '28000';
  end if;

  if v_role <> 'megadmin' and v_vendor_org is distinct from v_org then
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

  insert into public.audit_logs (action, entity, entity_id, user_email, detail, organizacion_id)
  values (
    'set_change_date_permission',
    'perfiles',
    p_vendor_id::text,
    coalesce(v_email, v_uid::text),
    jsonb_build_object('value', p_value),
    v_org
  );
end;
$$;

create or replace function public.set_branch_discount_auth(p_sucursal text, p_value boolean)
returns void
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_branch text;
  v_org uuid;
  v_email text;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '28000';
  end if;

  select rol, sucursal, organizacion_id into v_role, v_branch, v_org from public.perfiles where id = v_uid;

  if v_role not in ('supervisor', 'admin', 'megadmin') then
    raise exception 'Requiere supervisor o superior' using errcode = '42501';
  end if;

  if p_sucursal is null or btrim(p_sucursal) = '' then
    raise exception 'Sucursal requerida' using errcode = '22023';
  end if;

  if v_role = 'supervisor' and p_sucursal <> v_branch then
    raise exception 'Solo puedes administrar tu propia sucursal' using errcode = '42501';
  end if;

  -- La sucursal tiene que existir en la organización de quien la cambia.
  if not exists (select 1 from public.sucursales s where s.organizacion_id = v_org and s.nombre = p_sucursal) then
    raise exception 'Sucursal no encontrada' using errcode = '22023';
  end if;

  insert into public.sucursal_config (organizacion_id, sucursal, descuento_requiere_autorizacion, updated_at)
  values (v_org, p_sucursal, p_value, now())
  on conflict (organizacion_id, sucursal) do update
    set descuento_requiere_autorizacion = excluded.descuento_requiere_autorizacion,
        updated_at = now();

  select email into v_email from auth.users where id = v_uid;

  insert into public.audit_logs (action, entity, entity_id, user_email, detail, organizacion_id)
  values (
    'set_branch_discount_auth',
    'sucursal_config',
    p_sucursal,
    coalesce(v_email, v_uid::text),
    jsonb_build_object('value', p_value),
    v_org
  );
end;
$$;

create or replace function public.enforce_venta_descuento()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_branch text;
  v_required boolean;
  v_supervisor uuid;
begin
  -- Sin sesión de usuario (import de PROD, service role): se respeta lo que venga.
  if v_uid is null then
    return new;
  end if;

  -- Con sesión, el navegador nunca decide este campo.
  if tg_op = 'INSERT' then
    new.descuento_autorizado_por := null;
  else
    new.descuento_autorizado_por := old.descuento_autorizado_por;
  end if;

  select rol, sucursal into v_role, v_branch from public.perfiles where id = v_uid;

  -- Supervisor y admin/megadmin descuentan directo.
  if v_role is distinct from 'vendedor' then
    return new;
  end if;

  -- Hoy ninguna pantalla cambia el descuento de una venta ya creada: un vendedor no puede
  -- usar un UPDATE para meterse un descuento sin pasar por la autorización.
  if tg_op = 'UPDATE' then
    if new.descuento is distinct from old.descuento then
      raise exception 'Un vendedor no puede cambiar el descuento de una venta ya registrada'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if coalesce(new.descuento, 0) <= 0 then
    return new;
  end if;

  -- Cuenta la sucursal del perfil y la que trae la venta: si cualquiera lo exige, se exige.
  -- Solo la configuración de la organización de la venta.
  select coalesce(bool_or(descuento_requiere_autorizacion), false)
    into v_required
    from public.sucursal_config
   where organizacion_id = new.organizacion_id
     and sucursal in (v_branch, new.sucursal);

  if not v_required then
    return new;
  end if;

  update public.descuento_autorizaciones a
     set usado_en = now()
   where a.id = (
           select id from public.descuento_autorizaciones
            where vendedor_id = v_uid
              and usado_en is null
              and expira_en > now()
              and monto >= new.descuento
            order by creado_en
            limit 1
              for update skip locked
         )
  returning a.autorizado_por into v_supervisor;

  if v_supervisor is null then
    raise exception 'El descuento requiere autorización de un supervisor'
      using errcode = '42501';
  end if;

  new.descuento_autorizado_por := v_supervisor;
  return new;
end;
$$;
