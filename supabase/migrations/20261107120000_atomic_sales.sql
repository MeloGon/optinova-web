-- Cambio #26: ventas y abonos atómicos, sin huérfanos ni ventas sin líneas, y productos vendidos
-- que se archivan en vez de borrarse.
--
-- Por qué: Flutter guarda una venta en pasos sueltos (cabecera, líneas, stock, pago) y los borra por
-- separado. De ahí salen las 191 líneas huérfanas de PROD (cambio #8) y 257 ventas sin líneas.
-- Angular heredó el patrón de pasos sueltos (descontar stock leyendo y luego escribiendo, pago y
-- saldo en llamadas distintas). Acá todo lo que debe ir junto se hace en UNA transacción:
-- si cualquier paso falla, no queda nada a medias.
--
--   create_sale        venta + líneas + descuento de stock + pago inicial, todo o nada.
--   register_payment   abono + saldo de la venta, con la venta bloqueada (sin carreras).
--   remove_mount / remove_resin   borra el producto o, si ya se vendió, lo archiva.
--   trg_ventas_con_lineas         una venta nueva no puede guardarse sin líneas (ni a mano).
--
-- Las funciones son SECURITY INVOKER: corren con los permisos del usuario, así que RLS y los
-- triggers (descuento autorizado, creado_por, auditoría) se aplican como siempre.
-- Reglas que ya no se pueden saltar desde el navegador: el total sale de las líneas, el saldo se
-- calcula en el servidor, no se descuenta stock que no hay y no se abona más de lo que se debe.
--
-- Por qué NO hay CHECK sobre ventas.resta: 62 ventas viejas de PROD la tienen negativa y un CHECK
-- bloquearía cualquier edición de esas filas (p. ej. cambiar su fecha). La regla vive en las funciones.

-- 1) Productos archivables ---------------------------------------------------------------------
alter table public.armazones add column archivado_en timestamptz;
alter table public.resinas add column archivado_en timestamptz;

-- 0 filas con existencias negativas en PROD/DEV al aplicar: se puede exigir sobre todo el catálogo.
alter table public.armazones
  add constraint armazones_existencias_check check (existencias >= 0);

create index venta_items_id_montura_idx on public.venta_items (id_montura) where id_montura is not null;
create index venta_items_id_oftalmico_idx on public.venta_items (id_oftalmico) where id_oftalmico is not null;

-- Red de seguridad: ni a mano se puede borrar un producto que ya aparece en una venta.
-- Una función por tabla: `old` solo tiene las columnas de su propia tabla.
create function public.prevent_delete_sold_mount() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.venta_items where id_montura = old.id) then
    raise exception 'El armazón ya se vendió: se archiva, no se borra.' using errcode = '23503';
  end if;
  return old;
end;
$$;

create function public.prevent_delete_sold_resin() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.venta_items where id_oftalmico = old.id_oftalmico) then
    raise exception 'La resina ya se vendió: se archiva, no se borra.' using errcode = '23503';
  end if;
  return old;
end;
$$;

create trigger trg_armazones_no_borrar_vendido
before delete on public.armazones
for each row execute function public.prevent_delete_sold_mount();

create trigger trg_resinas_no_borrar_vendida
before delete on public.resinas
for each row execute function public.prevent_delete_sold_resin();

-- 'deleted' si nunca se vendió; 'archived' si ya aparece en alguna venta.
create function public.remove_mount(p_id bigint) returns text
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.venta_items where id_montura = p_id) then
    update public.armazones set archivado_en = coalesce(archivado_en, now()) where id = p_id;
    if not found then
      raise exception 'El armazón ya no existe o no tienes permiso para eliminarlo.' using errcode = 'P0002';
    end if;
    return 'archived';
  end if;

  delete from public.armazones where id = p_id;
  if not found then
    raise exception 'El armazón ya no existe o no tienes permiso para eliminarlo.' using errcode = 'P0002';
  end if;
  return 'deleted';
end;
$$;

create function public.remove_resin(p_id bigint) returns text
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.venta_items where id_oftalmico = p_id) then
    update public.resinas set archivado_en = coalesce(archivado_en, now()) where id_oftalmico = p_id;
    if not found then
      raise exception 'La resina ya no existe o no tienes permiso para eliminarla.' using errcode = 'P0002';
    end if;
    return 'archived';
  end if;

  delete from public.resinas where id_oftalmico = p_id;
  if not found then
    raise exception 'La resina ya no existe o no tienes permiso para eliminarla.' using errcode = 'P0002';
  end if;
  return 'deleted';
end;
$$;

-- 2) Una venta nueva no puede quedar sin líneas -------------------------------------------------
-- Trigger de restricción diferido: se comprueba al confirmar la transacción, así que la cabecera y
-- sus líneas pueden insertarse en cualquier orden dentro de ella. Las 257 ventas viejas sin líneas
-- no se tocan (solo aplica a inserciones nuevas).
create function public.check_sale_has_items() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.venta_items where venta_id = new.id) then
    raise exception 'La venta % no tiene productos: no se puede guardar sin líneas.', new.folio
      using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger trg_ventas_con_lineas
after insert on public.ventas
deferrable initially deferred
for each row execute function public.check_sale_has_items();

-- Una revisión nueva necesita paciente (las 452 viejas sin enlace siguen editables).
create function public.require_review_patient() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.paciente_id is null then
    raise exception 'La revisión necesita un paciente.' using errcode = '23502';
  end if;
  return new;
end;
$$;

create trigger trg_revisiones_paciente_obligatorio
before insert on public.revisiones
for each row execute function public.require_review_patient();

-- 3) create_sale: venta + líneas + stock + pago inicial, todo o nada -----------------------------
-- p_sale  = { sucursal, fecha (yyyy-MM-dd), paciente_id, paciente_nombre, autor_nombre,
--             total, descuento, motivo_descuento }
-- p_items = [ { id_oftalmico, descripcion, diseno, linea, material, tecnologia, texto, cantidad,
--               precio, id_montura, montura_marca, montura_modelo, montura_color, montura_texto,
--               montura_cantidad, montura_precio }, ... ]   (columnas de venta_items)
-- p_payment = { metodo_pago, notas } o null. El monto del pago inicial es siempre a_cuenta.
-- Devuelve la venta creada (jsonb, con paciente_id como texto: un bigint grande perdería dígitos).
create function public.create_sale(p_sale jsonb, p_items jsonb, p_payment jsonb default null)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_sale      public.ventas;
  v_total     numeric;
  v_sent      numeric := (p_sale ->> 'total')::numeric;
  v_discount  numeric := coalesce((p_sale ->> 'descuento')::numeric, 0);
  v_with_disc numeric;
  v_account   numeric := coalesce((p_sale ->> 'a_cuenta')::numeric, 0);
  v_method    text    := nullif(btrim(coalesce(p_payment ->> 'metodo_pago', '')), '');
  r           record;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta necesita al menos un producto.' using errcode = '22023';
  end if;
  if btrim(coalesce(p_sale ->> 'sucursal', '')) = '' then
    raise exception 'La venta necesita una sucursal.' using errcode = '22023';
  end if;
  if btrim(coalesce(p_sale ->> 'autor_nombre', '')) = '' then
    raise exception 'La venta necesita un vendedor.' using errcode = '22023';
  end if;
  if nullif(p_sale ->> 'paciente_id', '') is null then
    raise exception 'La venta necesita un paciente.' using errcode = '22023';
  end if;

  -- El total sale de las líneas, no de lo que diga el navegador.
  select coalesce(sum(coalesce(i.precio, 0) + coalesce(i.montura_precio, 0)), 0)
    into v_total
  from jsonb_populate_recordset(null::public.venta_items, p_items) i;

  if v_sent is not null and abs(v_sent - v_total) >= 0.01 then
    raise exception 'El total (%) no coincide con la suma de los productos (%).', v_sent, v_total
      using errcode = '22023';
  end if;
  if v_discount < 0 or v_discount > v_total then
    raise exception 'El descuento (%) no puede ser negativo ni mayor al total (%).', v_discount, v_total
      using errcode = '22023';
  end if;
  v_with_disc := v_total - v_discount;
  if v_account < 0 or v_account > v_with_disc then
    raise exception 'El monto a cuenta (%) debe estar entre 0 y el total con descuento (%).', v_account, v_with_disc
      using errcode = '22023';
  end if;
  if v_account > 0 and v_method is null then
    raise exception 'Indica el método de pago del monto a cuenta.' using errcode = '22023';
  end if;

  insert into public.ventas (
    sucursal, fecha_actualizada, fecha_venta_iso, paciente_nombre, paciente_id, autor_nombre,
    total, descuento, motivo_descuento, total_con_descuento, a_cuenta, resta
  ) values (
    btrim(p_sale ->> 'sucursal'),
    (p_sale ->> 'fecha')::date,
    (p_sale ->> 'fecha')::date,
    p_sale ->> 'paciente_nombre',
    (p_sale ->> 'paciente_id')::bigint,
    btrim(p_sale ->> 'autor_nombre'),
    v_total,
    v_discount,
    nullif(btrim(coalesce(p_sale ->> 'motivo_descuento', '')), ''),
    v_with_disc,
    v_account,
    v_with_disc - v_account
  )
  returning * into v_sale;

  -- Solo estas columnas entran desde el navegador; id/venta_id/folio los pone el servidor.
  insert into public.venta_items (
    venta_id, folio_venta, paciente_nombre, fecha_ventas_actualizada,
    id_oftalmico, descripcion, diseno, linea, material, tecnologia, texto, cantidad, precio,
    id_montura, montura_marca, montura_modelo, montura_color, montura_texto, montura_cantidad, montura_precio
  )
  select v_sale.id, v_sale.folio, v_sale.paciente_nombre, v_sale.fecha_venta_iso,
         i.id_oftalmico, i.descripcion, i.diseno, i.linea, i.material, i.tecnologia, i.texto, i.cantidad, i.precio,
         i.id_montura, i.montura_marca, i.montura_modelo, i.montura_color, i.montura_texto, i.montura_cantidad, i.montura_precio
  from jsonb_populate_recordset(null::public.venta_items, p_items) i;

  -- Stock: una sentencia por armazón, sin leer antes de escribir. Si dos ventas piden la última
  -- unidad a la vez, la segunda espera y falla (no se pierde ningún descuento ni baja de 0).
  for r in
    select i.id_montura as id, count(*) as n
    from jsonb_populate_recordset(null::public.venta_items, p_items) i
    where i.id_montura is not null and i.id_montura <> 0
    group by i.id_montura
  loop
    update public.armazones
    set existencias = existencias - r.n
    where id = r.id and coalesce(existencias, 0) >= r.n;
    if not found then
      raise exception 'El armazón % ya no está disponible o no alcanza el stock (se piden % unidad(es)).', r.id, r.n
        using errcode = '23514';
    end if;
  end loop;

  if v_account > 0 then
    insert into public.pagos (id_remision, monto, fecha_pago, metodo_pago, notas, tipo_pago, registrado_por)
    values (
      v_sale.id,
      v_account,
      v_sale.fecha_venta_iso,
      v_method,
      coalesce(nullif(btrim(coalesce(p_payment ->> 'notas', '')), ''), 'Pago inicial de venta'),
      'nueva_venta',
      auth.uid()
    );
  end if;

  return to_jsonb(v_sale) || jsonb_build_object('paciente_id', v_sale.paciente_id::text);
end;
$$;

-- 4) register_payment: abono + saldo con la venta bloqueada --------------------------------------
create function public.register_payment(
  p_sale_id text,
  p_amount numeric,
  p_date date,
  p_method text,
  p_notes text default null,
  p_type text default 'abono_saldo'
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_sale    public.ventas;
  v_payment public.pagos;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'El abono debe ser mayor a 0.' using errcode = '22023';
  end if;

  -- FOR UPDATE: dos abonos a la misma venta se hacen en fila, cada uno ve el saldo del anterior.
  select * into v_sale from public.ventas where id = p_sale_id for update;
  if not found then
    raise exception 'La venta ya no existe o no tienes permiso para verla.' using errcode = 'P0002';
  end if;

  if p_amount > coalesce(v_sale.resta, 0) + 0.004 then
    raise exception 'El abono (%) supera el saldo pendiente (%).', p_amount, coalesce(v_sale.resta, 0)
      using errcode = '22023';
  end if;

  insert into public.pagos (id_remision, monto, fecha_pago, metodo_pago, notas, tipo_pago, registrado_por)
  values (
    p_sale_id,
    p_amount,
    coalesce(p_date, current_date),
    p_method,
    nullif(btrim(coalesce(p_notes, '')), ''),
    coalesce(p_type, 'abono_saldo'),
    auth.uid()
  )
  returning * into v_payment;

  update public.ventas
  set a_cuenta = coalesce(a_cuenta, 0) + p_amount,
      resta = greatest(coalesce(resta, 0) - p_amount, 0),
      fecha_actualizada = coalesce(p_date, current_date)
  where id = p_sale_id
  returning * into v_sale;

  return jsonb_build_object('payment', to_jsonb(v_payment), 'sale', to_jsonb(v_sale));
end;
$$;

-- Solo usuarios con sesión: nada de `anon`.
revoke all on function public.create_sale(jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.register_payment(text, numeric, date, text, text, text) from public, anon;
revoke all on function public.remove_mount(bigint) from public, anon;
revoke all on function public.remove_resin(bigint) from public, anon;
grant execute on function public.create_sale(jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.register_payment(text, numeric, date, text, text, text) to authenticated;
grant execute on function public.remove_mount(bigint) to authenticated;
grant execute on function public.remove_resin(bigint) to authenticated;

-- Las funciones de trigger no deben poder llamarse por RPC (mismo criterio que el cambio #25).
revoke all on function public.prevent_delete_sold_mount() from public, anon, authenticated;
revoke all on function public.prevent_delete_sold_resin() from public, anon, authenticated;
revoke all on function public.check_sale_has_items() from public, anon, authenticated;
revoke all on function public.require_review_patient() from public, anon, authenticated;

-- 5) Dashboard: los armazones archivados no cuentan como stock bajo ni agotados ------------------

CREATE OR REPLACE FUNCTION public.dashboard_summary(p_branch text DEFAULT NULL::text, p_tz text DEFAULT 'America/Lima'::text, p_period text DEFAULT 'week'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
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
      and a.archivado_en is null
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
$function$;
