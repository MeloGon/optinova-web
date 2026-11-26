-- Eliminar una venta de forma atómica (pedido del dueño, 2026-11-25).
--
-- Antes (Flutter anterior) se hacía desde el navegador en pasos sueltos: devolver stock de
-- armazones, borrar pagos y borrar la venta. Si un paso fallaba a la mitad la venta quedaba a
-- medio borrar (de ahí las líneas huérfanas de PROD, ver migración #8). Ahora todo va en una
-- sola función: o se hace todo o nada.
--
-- Quién puede: lo decide la Edge Function `delete-sale` (supervisor+ directo; vendedor con
-- correo y contraseña de un supervisor de su empresa). Por eso la función solo la puede llamar
-- `service_role`, y se quita el DELETE directo sobre `ventas` a `authenticated`.

create or replace function public.delete_sale(
  p_id text,
  p_actor_email text,
  p_authorized_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale     public.ventas;
  v_payments integer;
  v_mounts   integer := 0;
  r          record;
begin
  select * into v_sale from public.ventas where id = p_id for update;
  if not found then
    raise exception 'La venta ya no existe.' using errcode = 'P0002';
  end if;

  -- Devuelve al stock cada armazón vendido (create_sale descuenta 1 por línea).
  for r in
    select id_montura as id, count(*) as n
    from public.venta_items
    where venta_id = p_id and id_montura is not null and id_montura <> 0
    group by id_montura
  loop
    update public.armazones set existencias = coalesce(existencias, 0) + r.n where id = r.id;
    if found then
      v_mounts := v_mounts + r.n;
    end if;
  end loop;

  -- Los pagos primero: su FK a la venta no borra en cascada. Las líneas sí (ON DELETE CASCADE).
  delete from public.pagos where id_remision = p_id;
  get diagnostics v_payments = row_count;

  -- El trigger de auditoría toma el correo del JWT; llamada como service_role no tendría el de
  -- quien elimina, así que se fija solo para esta transacción.
  perform set_config('request.jwt.claims', jsonb_build_object('email', p_actor_email)::text, true);
  delete from public.ventas where id = p_id;

  -- Completa el registro que dejó el trigger (delete_sale) con lo que hizo esta función.
  update public.audit_logs
  set organizacion_id = coalesce(organizacion_id, v_sale.organizacion_id),
      detail = detail || jsonb_build_object(
        'pagos_borrados', v_payments,
        'armazones_devueltos', v_mounts,
        'autorizado_por', p_authorized_by
      )
  where id = (
    select id from public.audit_logs
    where action = 'delete_sale' and entity_id = v_sale.folio
    order by created_at desc
    limit 1
  );

  return jsonb_build_object('folio', v_sale.folio, 'pagos', v_payments, 'armazones', v_mounts);
end;
$$;

revoke all on function public.delete_sale(text, text, text) from public, anon, authenticated;
grant execute on function public.delete_sale(text, text, text) to service_role;

-- Ya nadie borra ventas directo desde el navegador.
revoke delete on public.ventas from authenticated;
