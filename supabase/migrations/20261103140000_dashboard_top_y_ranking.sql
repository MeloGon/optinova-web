-- Cambio #16: "Top del mes" (armazones y marcas más vendidos) y ranking de vendedores del dashboard.
-- Reemplaza dashboard_summary(text, text, text) del cambio #15 (misma firma, dos bloques más).
--
-- Ambos miran el MES EN CURSO (del día 1 a hoy en la hora de la empresa), sea cual sea el periodo
-- elegido, igual que expenses_month, y las ventas dentro del alcance del rol.
--
-- top_products:
--   Se arma con las líneas de armazón de venta_items: una línea con marca o modelo cuenta como un
--   armazón. Las unidades salen de montura_cantidad (texto); si no es un entero positivo vale 1,
--   porque cada línea nueva es una unidad. El importe es montura_precio por unidades.
--   brands: las 5 marcas con más unidades. models: los 5 armazones (marca + modelo).
--   Agrupa sin distinguir mayúsculas ni espacios en los bordes (Ray-Ban = RAY-BAN) y muestra la
--   escritura más frecuente. Desempate: más importe, luego nombre.
-- seller_ranking:
--   Los 5 vendedores (autor_nombre, el vendedor a cuyo nombre queda la venta, no quien tecleó)
--   con más importe vendido en el mes. Solo para supervisor, admin y megadmin: el vendedor recibe
--   null, igual que ingresos y egresos. Un vendedor ve lo suyo en "Mis ventas" con periodo Mes.

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
  v_month      date;   -- primer día del mes en curso
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
  v_month  := date_trunc('month', v_today)::date;

  if v_period = 'today' then
    v_from := v_today;
    v_prev_from := v_today - 1;
    v_prev_to := v_today - 1;
  elsif v_period = 'week' then
    v_from := v_today - 6;
    v_prev_from := v_today - 13;
    v_prev_to := v_today - 7;
  else
    v_from := v_month;
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
  ),
  -- Inventario de armazones del alcance (por sucursal) con dato de existencias.
  mounts as (
    select a.id, a.marca, a.modelo, a.color, a.descripcion, a.codigo_barras, a.sucursal,
           a.existencias, a.precio
    from public.armazones a
    where a.existencias is not null
      and (case v_scope when 'all' then v_filter is null or a.sucursal = v_filter
                        else a.sucursal = v_branch end)
  ),
  low as (
    select * from mounts where existencias between 1 and 2
  ),
  -- Líneas de armazón vendidas en el mes (las unidades salen de un texto: CASE evita castear basura).
  sold as (
    select btrim(coalesce(i.montura_marca, '')) as brand,
           btrim(coalesce(i.montura_modelo, '')) as model,
           case when i.montura_cantidad ~ '^[0-9]{1,4}$' then greatest(i.montura_cantidad::int, 1) else 1 end as units,
           coalesce(i.montura_precio, 0) as price
    from public.venta_items i
    join v on v.id = i.venta_id
    where v.fecha between v_month and v_today
      and (btrim(coalesce(i.montura_marca, '')) <> '' or btrim(coalesce(i.montura_modelo, '')) <> '')
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
    'low_stock', jsonb_build_object(
      'count',     (select count(*) from low),
      'out_count', (select count(*) from mounts where existencias = 0),
      'items', (
        select coalesce(jsonb_agg(to_jsonb(t) order by t.stock, t.brand, t.model, t.id), '[]'::jsonb)
        from (
          select id::text as id, marca as brand, modelo as model, color, descripcion as description,
                 codigo_barras as code, sucursal as branch, existencias as stock, precio as price
          from low
          order by existencias, marca, modelo, id
          limit 6
        ) t
      )
    ),
    'top_products', jsonb_build_object(
      'brands', (
        select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'units', x.units, 'total', x.total)
                                  order by x.units desc, x.total desc, x.name), '[]'::jsonb)
        from (
          select mode() within group (order by brand) as name, sum(units)::int as units, sum(units * price) as total
          from sold
          where brand <> ''
          group by upper(brand)
          order by sum(units) desc, sum(units * price) desc, upper(brand)
          limit 5
        ) x
      ),
      'models', (
        select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'units', x.units, 'total', x.total)
                                  order by x.units desc, x.total desc, x.name), '[]'::jsonb)
        from (
          select btrim(mode() within group (order by brand) || ' ' || mode() within group (order by model)) as name,
                 sum(units)::int as units, sum(units * price) as total
          from sold
          group by upper(brand), upper(model)
          order by sum(units) desc, sum(units * price) desc, upper(brand), upper(model)
          limit 5
        ) x
      )
    ),
    'seller_ranking', case when v_money then (
      select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'count', x.cnt, 'total', x.total)
                                order by x.total desc, x.name), '[]'::jsonb)
      from (
        select mode() within group (order by btrim(v.autor_nombre)) as name,
               count(*)::int as cnt, coalesce(sum(v.total), 0) as total
        from v
        where v.fecha between v_month and v_today
          and btrim(coalesce(v.autor_nombre, '')) <> ''
        group by upper(btrim(v.autor_nombre))
        order by coalesce(sum(v.total), 0) desc, upper(btrim(v.autor_nombre))
        limit 5
      ) x
    ) end,
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
        where e.fecha >= v_month
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
