-- Cambio #13: dashboard con periodo (hoy / 7 días / mes), comparación contra el periodo anterior
-- y series diarias para las mini gráficas. Reemplaza dashboard_summary(text, text) del cambio #12.
--
-- Periodos y su comparación:
--   today: hoy                         vs ayer
--   week : últimos 7 días (hoy incl.)  vs los 7 días anteriores
--   month: del día 1 a hoy             vs el mismo tramo del mes anterior (sin pasarse de su fin)
-- Sin cambios de alcance: el rol y la sucursal se leen del servidor (perfiles + auth.uid()).
-- Las tarjetas de ingresos y métodos de pago siguen en null para el vendedor.

drop function if exists public.dashboard_summary(text, text);

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
  v_from       date;   -- inicio del periodo actual
  v_prev_from  date;   -- periodo anterior (mismo largo)
  v_prev_to    date;
  v_chart_from date;   -- desde cuándo van las barras y las mini gráficas
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
    -- mismo tramo del mes anterior, sin pasarse al mes en curso (ej. 31 de marzo vs febrero)
    v_prev_to := least(v_prev_from + (v_today - v_from), v_from - 1);
  end if;
  -- "hoy" se muestra con la última semana de contexto; el mes, día por día
  v_chart_from := case v_period when 'month' then v_from else v_today - 6 end;

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
    select v_chart_from + g as day from generate_series(0, v_today - v_chart_from) g
  ),
  -- Pagos del alcance desde el inicio del periodo anterior o de las barras, lo que llegue más atrás.
  pay as (
    select p.fecha_pago as fecha, p.monto, p.metodo_pago
    from public.pagos p
    join v on v.id = p.id_remision
    where p.fecha_pago between least(v_prev_from, v_chart_from) and v_today
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
      'receivable', (select coalesce(sum(resta), 0) from v where resta > 0),
      'patients', (
        select count(*) from public.pacientes pa
        where pa.archivado_en is null
          and (case v_scope when 'all' then v_filter is null or pa.sucursal = v_filter
                            else pa.sucursal = v_branch end)
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

revoke all on function public.dashboard_summary(text, text, text) from public, anon;
grant execute on function public.dashboard_summary(text, text, text) to authenticated;
