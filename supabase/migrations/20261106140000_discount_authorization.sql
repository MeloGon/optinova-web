-- Cambio #24: autorización de descuentos por sucursal (P-04 en Vender).
--
-- Regla: cada sucursal tiene un interruptor `descuento_requiere_autorizacion`.
--   - Apagado (default): el vendedor aplica descuento directo.
--   - Encendido: el vendedor necesita que un supervisor+ ponga su correo y contraseña. Esas
--     credenciales las verifica el Edge Function `authorize-discount`, que deja un registro de
--     autorización de un solo uso y con vencimiento corto en `descuento_autorizaciones`.
--     El trigger de `ventas` exige y consume ese registro al insertar la venta, así que el
--     navegador no puede saltarse la regla (lo único que cuenta es lo que hay en la tabla,
--     que solo escribe el service role).
-- Supervisor y admin/megadmin siempre descuentan directo.
--
-- El interruptor lo cambia el supervisor de la sucursal o admin/megadmin (cualquiera), con
-- el mismo molde de `set_vendor_change_date_permission` (#22).
--
-- Las sucursales siguen siendo texto (Fase 4b las convertirá en tabla con `sucursal_id`).

-- 1) Interruptor por sucursal ------------------------------------------------------------------
create table public.sucursal_config (
  sucursal text primary key,
  descuento_requiere_autorizacion boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.sucursal_config is
  'Ajustes por sucursal (texto, hasta la Fase 4b). Sin fila = valores por defecto. Se escribe solo con set_branch_discount_auth().';

alter table public.sucursal_config enable row level security;

-- Lectura abierta a cualquier autenticado: la pantalla de Vender necesita saber si pedir permiso.
create policy "authenticated can read sucursal_config" on public.sucursal_config
  for select to authenticated using (true);

revoke all on public.sucursal_config from anon, authenticated;
grant select on public.sucursal_config to authenticated;

-- 2) Autorizaciones de un solo uso --------------------------------------------------------------
create table public.descuento_autorizaciones (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references public.perfiles (id) on delete cascade,
  autorizado_por uuid not null references public.perfiles (id) on delete cascade,
  monto numeric not null check (monto > 0),
  creado_en timestamptz not null default now(),
  expira_en timestamptz not null default now() + interval '10 minutes',
  usado_en timestamptz
);

comment on table public.descuento_autorizaciones is
  'Permiso de un supervisor+ para que un vendedor aplique un descuento de hasta `monto`. Un solo uso, vence a los 10 minutos. Solo lo escribe el Edge Function authorize-discount (service role).';

create index descuento_autorizaciones_vendedor_idx
  on public.descuento_autorizaciones (vendedor_id) where usado_en is null;

alter table public.descuento_autorizaciones enable row level security;
-- Sin políticas y sin grants: ni el navegador ni un vendedor la leen ni la escriben.
revoke all on public.descuento_autorizaciones from anon, authenticated;

-- 3) ventas: quién autorizó el descuento --------------------------------------------------------
alter table public.ventas
  add column descuento_autorizado_por uuid references public.perfiles (id) on delete set null;

comment on column public.ventas.descuento_autorizado_por is
  'Supervisor+ que autorizó el descuento cuando lo aplicó un vendedor y la sucursal lo exigía. Lo pone el trigger; NULL si no hizo falta.';

-- 4) Trigger: hace cumplir la regla en el servidor ----------------------------------------------
create or replace function public.enforce_venta_descuento() returns trigger
    language plpgsql security definer
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
  select coalesce(bool_or(descuento_requiere_autorizacion), false)
    into v_required
    from public.sucursal_config
   where sucursal in (v_branch, new.sucursal);

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

revoke all on function public.enforce_venta_descuento() from public, anon, authenticated;

create trigger trg_ventas_descuento
  before insert or update on public.ventas
  for each row execute function public.enforce_venta_descuento();

-- 5) Cambiar el interruptor de una sucursal -----------------------------------------------------
create or replace function public.set_branch_discount_auth(p_sucursal text, p_value boolean)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_branch text;
  v_email text;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '28000';
  end if;

  select rol, sucursal into v_role, v_branch from public.perfiles where id = v_uid;

  if v_role not in ('supervisor', 'admin', 'megadmin') then
    raise exception 'Requiere supervisor o superior' using errcode = '42501';
  end if;

  if p_sucursal is null or btrim(p_sucursal) = '' then
    raise exception 'Sucursal requerida' using errcode = '22023';
  end if;

  if v_role = 'supervisor' and p_sucursal <> v_branch then
    raise exception 'Solo puedes administrar tu propia sucursal' using errcode = '42501';
  end if;

  insert into public.sucursal_config (sucursal, descuento_requiere_autorizacion, updated_at)
  values (p_sucursal, p_value, now())
  on conflict (sucursal) do update
    set descuento_requiere_autorizacion = excluded.descuento_requiere_autorizacion,
        updated_at = now();

  select email into v_email from auth.users where id = v_uid;

  insert into public.audit_logs (action, entity, entity_id, user_email, detail)
  values (
    'set_branch_discount_auth',
    'sucursal_config',
    p_sucursal,
    coalesce(v_email, v_uid::text),
    jsonb_build_object('value', p_value)
  );
end;
$$;

revoke all on function public.set_branch_discount_auth(text, boolean) from public, anon;
grant execute on function public.set_branch_discount_auth(text, boolean) to authenticated;
