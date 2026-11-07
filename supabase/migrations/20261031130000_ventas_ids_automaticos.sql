-- Cambio #10: ventas.id y ventas.folio pasan a generarse en la base (secuencia),
-- igual que pacientes (#5) y revisiones (#7).
--
-- Antes: Flutter inventaba ambos con dígitos al azar en el navegador (hasta 17).
--        En PROD el folio choca en el 28% de las ventas: solo 17,872 folios
--        distintos en 24,827 ventas (comprobado antes de aplicar). El ID no
--        choca de milagro (bigint da mucho más rango), pero tiene el mismo riesgo.
-- Ahora: ambos salen de una secuencia que arranca en el mayor valor existente + 1.
--        Los valores viejos no se tocan.
--
-- venta_items.id (bigint, sin FK externa que dependa de su valor) recibe el mismo
-- arreglo: hoy no tiene default y también lo inventaba el navegador.
--
-- Necesario para E2.6 Vender, primera feature que inserta ventas nuevas.
-- Sirve igual sobre DEV y sobre una copia de PROD (corte, Fase 5): al aplicarse
-- recoloca las secuencias sobre los datos que haya en ese momento.

create sequence public.ventas_id_seq as bigint owned by public.ventas.id;
select setval(
  'public.ventas_id_seq',
  (select coalesce(max(id::bigint), 0) + 1 from public.ventas where id ~ '^[0-9]+$'),
  false
);
alter table public.ventas
  alter column id set default (nextval('public.ventas_id_seq'))::text;

create sequence public.ventas_folio_seq as bigint owned by public.ventas.folio;
-- Solo folios de hasta 9 dígitos: en PROD hay 3 ventas de dic-2025 con folio de 17 dígitos (al azar,
-- hechas por Flutter) que, de contarse, harían que todo folio nuevo saliera de 17 dígitos. Los
-- folios normales llegan a 6 dígitos (997 833 al 2026-11-06); esos 3 quedan como están.
select setval(
  'public.ventas_folio_seq',
  (select coalesce(max(folio::bigint), 0) + 1 from public.ventas where folio ~ '^[0-9]{1,9}$'),
  false
);
alter table public.ventas
  alter column folio set default (nextval('public.ventas_folio_seq'))::text;

create sequence public.venta_items_id_seq as bigint owned by public.venta_items.id;
select setval(
  'public.venta_items_id_seq',
  (select coalesce(max(id), 0) + 1 from public.venta_items),
  false
);
alter table public.venta_items
  alter column id set default nextval('public.venta_items_id_seq');

-- Quien inserta (usuarios con sesión) necesita permiso para usar las secuencias.
grant usage, select on sequence public.ventas_id_seq to authenticated, service_role;
grant usage, select on sequence public.ventas_folio_seq to authenticated, service_role;
grant usage, select on sequence public.venta_items_id_seq to authenticated, service_role;
