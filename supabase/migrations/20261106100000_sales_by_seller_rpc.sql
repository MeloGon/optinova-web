-- Cambio #23: RPCs `sales_by_seller_summary`/`sales_by_seller_detail` — "Ventas por vendedor"
-- (E2.8) dejan de traer el mes completo de TODAS las ventas (de todos los vendedores) al
-- navegador para agrupar/filtrar/paginar ahí; la suma y el filtro se hacen en Postgres, mismo
-- molde que `dashboard_summary`/`payments_report`. El navegador recibe solo lo que muestra:
-- el ranking agregado (chico, no crece con la cantidad de ventas) o la página de un vendedor.
--
-- Hallazgo del dueño, 2026-11-06: cuidar el consumo de Supabase (egress) desde ahora, antes de
-- que el volumen real de la óptica lo vuelva un problema. No es un bug de los 1000 registros de
-- PostgREST (eso no aplica acá: ambas funciones devuelven un solo `jsonb`, no un set de filas);
-- es simplemente evitar descargar de más en cada apertura de estas 2 pantallas.
--
-- Reemplaza a `SaleRepository.listByMonth`, eliminado del contrato en el mismo commit.
-- Gate: solo admin/megadmin (mismo rol que ya exige la ruta `settings/sales-by-seller`, acá
-- reforzado en el servidor — mismo motivo que el hallazgo de alcance de `payments_report`, #19).
--
-- Normalización del nombre del vendedor (`autor_nombre` es texto libre, sin FK a `vendedores`):
-- `initcap(btrim(...))` imita a `sellerKey()` del frontend (recorta espacios y pone Mayúscula
-- Inicial por palabra). Límite conocido, igual que en el frontend: no colapsa espacios dobles
-- internos; aceptable al volumen actual, no es nuevo de este cambio.

create or replace function public.sales_by_seller_summary(
  p_from date,
  p_to date,
  p_branch text default null
) returns jsonb
    language plpgsql stable security definer
    set search_path to 'public', 'auth', 'pg_temp'
    as $$
declare
  v_uid    uuid := auth.uid();
  v_role   text;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '28000';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Rango de fechas inválido' using errcode = '22023';
  end if;

  select rol into v_role from public.perfiles where id = v_uid;
  if v_role is null then
    raise exception 'Perfil no encontrado' using errcode = '28000';
  end if;
  if v_role not in ('admin', 'megadmin') then
    raise exception 'Requiere admin o superior' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'name', name,
    'sales_count', sales_count,
    'total', total,
    'account', account,
    'rest', rest
  ) order by total desc), '[]'::jsonb)
  into v_result
  from (
    select
      coalesce(nullif(initcap(btrim(autor_nombre)), ''), 'Sin vendedor') as name,
      count(*) as sales_count,
      sum(coalesce(total_con_descuento, total, 0)) as total,
      sum(coalesce(a_cuenta, 0)) as account,
      sum(coalesce(resta, greatest(coalesce(total_con_descuento, total, 0) - coalesce(a_cuenta, 0), 0))) as rest
    from public.ventas
    where fecha_actualizada between p_from and p_to
      and (p_branch is null or sucursal = p_branch)
    group by 1
  ) agg;

  return jsonb_build_object('sellers', v_result);
end;
$$;

revoke all on function public.sales_by_seller_summary(date, date, text) from public, anon;
grant execute on function public.sales_by_seller_summary(date, date, text) to authenticated;

create or replace function public.sales_by_seller_detail(
  p_from date,
  p_to date,
  p_seller_name text,
  p_branch text default null,
  p_page int default 1,
  p_page_size int default 25
) returns jsonb
    language plpgsql stable security definer
    set search_path to 'public', 'auth', 'pg_temp'
    as $$
declare
  v_uid         uuid := auth.uid();
  v_role        text;
  v_total_count int;
  v_total       numeric;
  v_account     numeric;
  v_rest        numeric;
  v_sales       jsonb;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '28000';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Rango de fechas inválido' using errcode = '22023';
  end if;
  if p_seller_name is null or btrim(p_seller_name) = '' then
    raise exception 'Vendedor requerido' using errcode = '22023';
  end if;
  if p_page is null or p_page < 1 then p_page := 1; end if;
  if p_page_size is null or p_page_size < 1 then p_page_size := 25; end if;

  select rol into v_role from public.perfiles where id = v_uid;
  if v_role is null then
    raise exception 'Perfil no encontrado' using errcode = '28000';
  end if;
  if v_role not in ('admin', 'megadmin') then
    raise exception 'Requiere admin o superior' using errcode = '42501';
  end if;

  select
    count(*),
    sum(coalesce(total_con_descuento, total, 0)),
    sum(coalesce(a_cuenta, 0)),
    sum(coalesce(resta, greatest(coalesce(total_con_descuento, total, 0) - coalesce(a_cuenta, 0), 0)))
  into v_total_count, v_total, v_account, v_rest
  from public.ventas
  where fecha_actualizada between p_from and p_to
    and (p_branch is null or sucursal = p_branch)
    and coalesce(nullif(initcap(btrim(autor_nombre)), ''), 'Sin vendedor') = p_seller_name;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'folio', folio,
    'branch', sucursal,
    'date', fecha_actualizada,
    'patient_name', paciente_nombre,
    'patient_id', paciente_id::text,
    'seller_name', autor_nombre,
    'total', total,
    'discount', descuento,
    'total_with_discount', total_con_descuento,
    'account', a_cuenta,
    'rest', resta
  ) order by fecha_actualizada desc), '[]'::jsonb)
  into v_sales
  from (
    select *
    from public.ventas
    where fecha_actualizada between p_from and p_to
      and (p_branch is null or sucursal = p_branch)
      and coalesce(nullif(initcap(btrim(autor_nombre)), ''), 'Sin vendedor') = p_seller_name
    order by fecha_actualizada desc, id desc
    limit p_page_size
    offset (p_page - 1) * p_page_size
  ) page_rows;

  return jsonb_build_object(
    'total_count', v_total_count,
    'total', coalesce(v_total, 0),
    'account', coalesce(v_account, 0),
    'rest', coalesce(v_rest, 0),
    'sales', v_sales
  );
end;
$$;

revoke all on function public.sales_by_seller_detail(date, date, text, text, int, int) from public, anon;
grant execute on function public.sales_by_seller_detail(date, date, text, text, int, int) to authenticated;
