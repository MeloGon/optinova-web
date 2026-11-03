-- Cambio #14: bloque "Cobranza" del dashboard (saldos por cobrar por antigüedad y mayores saldos).
-- Reemplaza dashboard_summary(text, text, text) del cambio #13 (misma firma, un bloque más).
--
-- collections: ventas con saldo (resta > 0) dentro del alcance del rol (el mismo de las ventas del
-- resumen: vendedor, sus ventas; supervisor, su sucursal; admin y megadmin, todo con filtro opcional).
--   buckets: antigüedad de la venta contra hoy: recent (0-7 días), mid (8-30), old (31 o más).
--            Una venta sin fecha cuenta como old: no se sabe cuánto lleva pendiente.
--   top:     las 5 ventas con mayor saldo, con los datos que necesita "Registrar abono".
-- No depende del periodo: es una foto de hoy, igual que el saldo por cobrar.

create or replace function public.dashboard_summary(
  p_branch text default null,
  p_tz text default 'America/Lima',
  p_period text default 'week'
) returns jsonb
    language plpgsql stable security definer
    set search_path to 'public', 'auth', 'pg_temp'
    as $$
declare
  v_uid        uuid := auth.uid();
  v_role       text;
  v_branch     text;
  v_name       text;
  v_today      date := (now() at time zone p_tz)::date;
  v_period     text := coalesce(p_period, 'week');
  v_scope      text;
  v_filter     text;
  v_money      boolean;
  v_from       date;
  v_prev_from  date;
  v_prev_to    date;
  v_chart_from date;
  v_result     jsonb;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '28000';
  end if;
  if v_period not in ('today', 'week', 'month') then
    raise exception 'Periodo no válido: %', v_period using errcode = '22023';
  end if;

  select rol, sucursal, nombre into v_role, v_branch, v_name
  from public.perfiles where id = v_uid;
  if v_role is null then
    raise exception 'Perfil no encontrado' using errcode = '28000';
  end if;

  v_scope  := case v_role when 'vendedor' then 'mine' when 'supervisor' then 'branch' else 'all' end;
  v_filter := case v_scope when 'all' then nullif(btrim(p_branch), '') else v_branch end;
  v_money  := v_scope <> 'mine';

  if v_period = 'today' then
    v_from := v_today;
    v_prev_from := v_today - 1;
    v_prev_to := v_today - 1;
  elsif v_period = 'week' then
    v_from := v_today - 6;
    v_prev_from := v_today - 13;
    v_prev_to := v_today - 7;
  else
    v_from := date_trunc('month', v_today)::date;
    v_prev_from := (v_from - interval '1 month')::date;
    v_prev_to := least(v_prev_from + (v_today - v_from), v_from - 1);
  end if;
  v_chart_from := case v_period when 'month' then v_from else v_today - 6 end;

  with
  -- Ventas dentro del alcance del rol.
  v as (
    select s.id, s.folio, s.fecha_actualizada as fecha, s.paciente_id, s.paciente_nombre,
           s.autor_nombre, s.sucursal, s.total as gross, s.descuento,
           s.total_con_descuento as total, s.a_cuenta, s.resta
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
  -- KPI "mis ventas": solo lo que quedó a MI nombre (autor_nombre).
  mine as (
    select s.fecha_actualizada as fecha, s.total_con_descuento as total
    from public.ventas s
    where v_name is not null and s.autor_nombre is not null
      and upper(btrim(s.autor_nombre)) = upper(btrim(v_name))
  ),
  days as (
    select v_chart_from + g as day from generate_series(0, v_today - v_chart_from) g
  ),
  pay as (
    select p.fecha_pago as fecha, p.monto, p.metodo_pago
    from public.pagos p
    join v on v.id = p.id_remision
    where p.fecha_pago between least(v_prev_from, v_chart_from) and v_today
  ),
  -- Ventas con saldo y cuánto llevan pendientes.
  owed as (
    select v.*,
           case when v.fecha is null then null else greatest(v_today - v.fecha, 0) end as age_days,
           case when v.fecha is null or v_today - v.fecha > 30 then 'old'
                when v_today - v.fecha > 7 then 'mid'
                else 'recent' end as bucket
    from v
    where v.resta > 0
  )
  select jsonb_build_object(
    'role',   v_role,
    'scope',  v_scope,
    'branch', v_filter,
    'today',  v_today,
    'period', v_period,
    'kpis', jsonb_build_object(
      'my_sales', jsonb_build_object(
        'count',          (select count(*) from mine where fecha between v_from and v_today),
        'total',          (select coalesce(sum(total), 0) from mine where fecha between v_from and v_today),
        'previous_total', (select coalesce(sum(total), 0) from mine where fecha between v_prev_from and v_prev_to),
        'series', (
          select jsonb_agg(jsonb_build_object(
                   'date', d.day,
                   'total', (select coalesce(sum(m.total), 0) from mine m where m.fecha = d.day)
                 ) order by d.day)
          from days d
        )
      ),
      'income', case when v_money then jsonb_build_object(
        'total',          (select coalesce(sum(monto), 0) from pay where fecha between v_from and v_today),
        'previous_total', (select coalesce(sum(monto), 0) from pay where fecha between v_prev_from and v_prev_to),
        'series', (
          select jsonb_agg(jsonb_build_object(
                   'date', d.day,
                   'total', (select coalesce(sum(p.monto), 0) from pay p where p.fecha = d.day)
                 ) order by d.day)
          from days d
        )
      ) end,
      'receivable', (select coalesce(sum(resta), 0) from owed),
      'patients', (
        select count(*) from public.pacientes pa
        where pa.archivado_en is null
          and (case v_scope when 'all' then v_filter is null or pa.sucursal = v_filter
                            else pa.sucursal = v_branch end)
      )
    ),
    'collections', jsonb_build_object(
      'total', (select coalesce(sum(resta), 0) from owed),
      'count', (select count(*) from owed),
      'buckets', (
        select jsonb_agg(jsonb_build_object(
                 'key', k.key,
                 'count', (select count(*) from owed o where o.bucket = k.key),
                 'total', (select coalesce(sum(o.resta), 0) from owed o where o.bucket = k.key)
               ) order by k.ord)
        from (values ('recent', 1), ('mid', 2), ('old', 3)) as k(key, ord)
      ),
      'top', (
        select coalesce(jsonb_agg(to_jsonb(t) order by t.rest desc, t.date asc nulls last, t.id), '[]'::jsonb)
        from (
          select id, folio, fecha as date, sucursal as branch, paciente_id::text as patient_id,
                 paciente_nombre as patient, autor_nombre as seller, gross as total, descuento as discount,
                 total as total_with_discount, a_cuenta as account, resta as rest, age_days
          from owed
          order by resta desc, fecha asc nulls last, id
          limit 5
        ) t
      )
    ),
    'sales_by_day', (
      select jsonb_agg(jsonb_build_object(
               'date', d.day,
               'count', (select count(*) from v where v.fecha = d.day),
               'total', (select coalesce(sum(v.total), 0) from v where v.fecha = d.day)
             ) order by d.day)
      from days d
    ),
    'payment_methods', case when v_money then (
      select coalesce(jsonb_agg(jsonb_build_object('method', m, 'total', t) order by t desc), '[]'::jsonb)
      from (
        select coalesce(metodo_pago, 'otro') m, sum(monto) t
        from pay where fecha between v_from and v_today group by 1
      ) x
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

-- `create or replace` conserva los permisos; se repiten por si el archivo se aplica sobre una base limpia.
revoke all on function public.dashboard_summary(text, text, text) from public, anon;
grant execute on function public.dashboard_summary(text, text, text) to authenticated;
