-- Cambio #12: quién registró la venta (creado_por) + funciones del Dashboard con alcance por rol.
--
-- 1) ventas.creado_por: el usuario con sesión que registró la venta. Es distinto de autor_nombre,
--    que es el VENDEDOR a cuyo nombre queda la venta (elegido en el paso 3 de Vender).
--    Lo pone la base de datos (trigger con auth.uid()): el navegador no lo manda ni puede falsearlo.
-- 2) audit_log_sale(): el log de create_sale guarda también el vendedor y quién la registró.
-- 3) dashboard_summary() / dashboard_activity(): el rol y la sucursal se leen en el servidor
--    (perfiles + auth.uid()), nunca de parámetros; lo que el rol no puede ver vuelve null.

-- 1) creado_por ------------------------------------------------------------------------------
alter table public.ventas
  add column creado_por uuid references public.perfiles (id) on delete set null;

comment on column public.ventas.creado_por is
  'Usuario con sesión que registró la venta (lo pone el trigger). El vendedor de la venta es autor_nombre. NULL en ventas históricas importadas de PROD.';

create or replace function public.set_venta_creado_por() returns trigger
    language plpgsql
    set search_path to 'public'
    as $$
begin
  -- Con sesión de usuario (auth.uid() no nulo) siempre manda el servidor. Sin sesión
  -- (import de PROD, service role) se respeta lo que venga: NULL en datos históricos.
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.creado_por := auth.uid();
    else
      new.creado_por := old.creado_por;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.set_venta_creado_por() from public, anon, authenticated;

create trigger trg_ventas_creado_por
  before insert or update on public.ventas
  for each row execute function public.set_venta_creado_por();

-- Índices para el dashboard (fechas y alcance por usuario/sucursal).
create index if not exists ventas_fecha_actualizada_idx on public.ventas (fecha_actualizada);
create index if not exists ventas_creado_por_idx on public.ventas (creado_por);
create index if not exists ventas_sucursal_idx on public.ventas (sucursal);
create index if not exists pagos_fecha_pago_idx on public.pagos (fecha_pago);
create index if not exists egresos_fecha_idx on public.egresos (fecha);

-- 2) Auditoría: vendedor + quién la registró -------------------------------------------------
create or replace function public.audit_log_sale() returns trigger
    language plpgsql security definer
    set search_path to 'public', 'auth'
    as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.audit_logs(action, entity, entity_id, user_email, detail)
    values (
      'create_sale', 'sale', new.folio, audit_actor_email(),
      jsonb_build_object(
        'folio',             new.folio,
        'paciente',          new.paciente_nombre,
        'total',             new.total_con_descuento,
        'sucursal',          new.sucursal,
        'a_cuenta',          new.a_cuenta,
        'resta',             new.resta,
        'vendedor',          new.autor_nombre,
        'creado_por',        new.creado_por,
        'creado_por_nombre', (select p.nombre from public.perfiles p where p.id = new.creado_por)
      )
    );
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.audit_logs(action, entity, entity_id, user_email, detail)
    values (
      'delete_sale', 'sale', old.folio, audit_actor_email(),
      jsonb_build_object(
        'folio',    old.folio,
        'paciente', old.paciente_nombre,
        'total',    old.total_con_descuento,
        'sucursal', old.sucursal,
        'vendedor', old.autor_nombre
      )
    );
    return old;
  end if;
  return null;
end;
$$;

-- 3) Dashboard -------------------------------------------------------------------------------
-- p_branch: solo lo respeta admin/megadmin (filtro opcional). Supervisor y vendedor ignoran el
-- parámetro: su alcance sale de su perfil.
create or replace function public.dashboard_summary(
  p_branch text default null,
  p_tz text default 'America/Lima'
) returns jsonb
    language plpgsql stable security definer
    set search_path to 'public', 'auth', 'pg_temp'
    as $$
declare
  v_uid     uuid := auth.uid();
  v_role    text;
  v_branch  text;
  v_name    text;
  v_today   date := (now() at time zone p_tz)::date;
  v_scope   text;        -- 'mine' | 'branch' | 'all'
  v_filter  text;        -- sucursal efectiva (supervisor: la suya; admin: p_branch o null)
  v_money   boolean;     -- ¿ve ingresos y egresos?
  v_result  jsonb;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '28000';
  end if;

  select rol, sucursal, nombre into v_role, v_branch, v_name
  from public.perfiles where id = v_uid;
  if v_role is null then
    raise exception 'Perfil no encontrado' using errcode = '28000';
  end if;

  v_scope  := case v_role when 'vendedor' then 'mine' when 'supervisor' then 'branch' else 'all' end;
  v_filter := case v_scope when 'all' then nullif(btrim(p_branch), '') else v_branch end;
  v_money  := v_scope <> 'mine';

  with
  -- Ventas dentro del alcance del rol.
  v as (
    select s.id, s.folio, s.fecha_actualizada as fecha, s.paciente_nombre, s.autor_nombre,
           s.sucursal, s.total_con_descuento as total, s.resta
    from public.ventas s
    where case v_scope
      when 'mine' then
        s.creado_por = v_uid
        or (v_name is not null and s.autor_nombre is not null
            and upper(btrim(s.autor_nombre)) = upper(btrim(v_name)))
      else
        v_filter is null or s.sucursal = v_filter
    end
  ),
  -- KPI "mis ventas": solo lo que quedó a MI nombre (autor_nombre). Una venta que otro
  -- vendedor hizo desde mi cuenta no suma aquí, aunque sí aparece en mi lista (CTE v).
  mine as (
    select s.fecha_actualizada as fecha, s.total_con_descuento as total
    from public.ventas s
    where v_name is not null and s.autor_nombre is not null
      and upper(btrim(s.autor_nombre)) = upper(btrim(v_name))
  ),
  days as (
    select v_today - g as day from generate_series(0, 6) g
  ),
  pay as (
    select p.monto, p.metodo_pago
    from public.pagos p
    join v on v.id = p.id_remision
    where p.fecha_pago = v_today
  )
  select jsonb_build_object(
    'role',   v_role,
    'scope',  v_scope,
    'branch', v_filter,
    'today',  v_today,
    'kpis', jsonb_build_object(
      'my_sales_today_count', (select count(*) from mine where fecha = v_today),
      'my_sales_today_total', (select coalesce(sum(total), 0) from mine where fecha = v_today),
      'receivable',           (select coalesce(sum(resta), 0) from v where resta > 0),
      'patients', (
        select count(*) from public.pacientes pa
        where pa.archivado_en is null
          and (case v_scope when 'all' then v_filter is null or pa.sucursal = v_filter
                            else pa.sucursal = v_branch end)
      ),
      'income_today', case when v_money
        then (select coalesce(sum(monto), 0) from pay) end
    ),
    'sales_by_day', (
      select jsonb_agg(jsonb_build_object(
               'date', d.day,
               'count', (select count(*) from v where v.fecha = d.day),
               'total', (select coalesce(sum(v.total), 0) from v where v.fecha = d.day)
             ) order by d.day)
      from days d
    ),
    'payment_methods_today', case when v_money then (
      select coalesce(jsonb_agg(jsonb_build_object('method', m, 'total', t) order by t desc), '[]'::jsonb)
      from (select coalesce(metodo_pago, 'otro') m, sum(monto) t from pay group by 1) x
    ) end,
    'expenses_month', case when v_money then (
      select coalesce(jsonb_agg(jsonb_build_object(
               'category', cat, 'color', color, 'total', t) order by t desc), '[]'::jsonb)
      from (
        select coalesce(c.nombre, 'Sin categoría') cat, coalesce(c.color, '#94a3b8') color, sum(e.monto) t
        from public.egresos e
        left join public.categorias_egresos c on c.id = e.categoria_id
        where e.fecha >= date_trunc('month', v_today)::date
          and e.fecha <= v_today
          and (case v_scope when 'all' then v_filter is null or e.sucursal = v_filter
                            else e.sucursal = v_branch end)
        group by 1, 2
      ) x
    ) end,
    'recent_sales', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.fecha desc, r.id desc), '[]'::jsonb)
      from (
        select id, folio, fecha, paciente_nombre as patient, autor_nombre as seller, total, resta as rest
        from v order by fecha desc nulls last, id desc limit 5
      ) r
    )
  ) into v_result;

  return v_result;
end;
$$;

-- Actividad reciente (auditoría): solo admin o megadmin.
create or replace function public.dashboard_activity(p_limit int default 8) returns jsonb
    language plpgsql stable security definer
    set search_path to 'public', 'auth', 'pg_temp'
    as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Sesión requerida' using errcode = '28000';
  end if;
  select rol into v_role from public.perfiles where id = auth.uid();
  if v_role is null or v_role not in ('admin', 'megadmin') then
    raise exception 'Solo un administrador o superior puede ver la actividad' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]'::jsonb)
    from (
      select action, entity, entity_id, user_email, detail, created_at
      from public.audit_logs
      order by created_at desc
      limit least(greatest(coalesce(p_limit, 8), 1), 50)
    ) a
  );
end;
$$;

-- Solo usuarios con sesión: sin esto, el GRANT por defecto las dejaría abiertas a anon.
revoke all on function public.dashboard_summary(text, text) from public, anon;
revoke all on function public.dashboard_activity(int) from public, anon;
grant execute on function public.dashboard_summary(text, text) to authenticated;
grant execute on function public.dashboard_activity(int) to authenticated;
