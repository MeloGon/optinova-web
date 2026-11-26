-- Vendedores para el filtro de Historial de ventas (pedido del dueño, 2026-11-25).
--
-- La venta guarda al vendedor como texto (`autor_nombre`) y la mayor parte del historial es de
-- personas sin usuario, así que la lista sale de las propias ventas, sin repetir y agrupando
-- mayúsculas/minúsculas ("MITZI" = "Mitzi"), igual que `sales_by_seller_summary`.
--
-- `security invoker`: corre con los permisos de quien llama, así que RLS ("por organizacion")
-- deja ver solo los vendedores de su empresa; un megadmin ve todas.

create or replace function public.sale_sellers()
returns table (name text, sales_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select initcap(btrim(autor_nombre)) as name, count(*) as sales_count
  from public.ventas
  where nullif(btrim(autor_nombre), '') is not null
  group by 1
  order by 1;
$$;

revoke all on function public.sale_sellers() from public, anon;
grant execute on function public.sale_sellers() to authenticated;
