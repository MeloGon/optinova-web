-- Cambio #19: `payments_report(p_from, p_to, p_branch)` — Reporte de pagos (E2.8) hecho server-side,
-- mismo molde que `dashboard_summary` (#13): el rol y la sucursal se leen de `perfiles` con
-- `auth.uid()`, nunca de lo que mande el cliente.
--
-- Hallazgo (dueño + Codex, 2026-11-04/05): la pantalla de Ingresos y egresos filtraba la sucursal
-- del supervisor solo en el cliente (`payments-report.page.ts`); nada del lado del servidor lo
-- hacía cumplir, a diferencia del Dashboard. Un supervisor con las herramientas de desarrollador
-- del navegador podía pedir directo a la API los montos de otra sucursal.
--
-- Reglas (confirmadas con el dueño): vendedor no entra (ya bloqueado por ruta, y ahora también
-- aquí); supervisor ve solo su sucursal, sin poder elegir otra aunque la mande por parámetro;
-- admin/megadmin ven la que pidan o todas si no mandan ninguna.

create or replace function public.payments_report(
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
  v_branch text;
  v_filter text;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Sesión requerida' using errcode = '28000';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Rango de fechas inválido' using errcode = '22023';
  end if;

  select rol, sucursal into v_role, v_branch from public.perfiles where id = v_uid;
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
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.payments_report(date, date, text) from public, anon;
grant execute on function public.payments_report(date, date, text) to authenticated;
