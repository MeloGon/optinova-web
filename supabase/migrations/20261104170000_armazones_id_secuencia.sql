-- Cambio #18: armazones.id pasa a generarse en la base (secuencia), igual que pacientes (#5),
-- revisiones (#7) y ventas/venta_items (#10).
--
-- Hallazgo de Antigravity (2026-11-04, prueba de E2.8): crear un armazón desde la UI fallaba con
-- "null value in column id ... violates not-null constraint". Causa: la migración #9 solo
-- renombró "ID ARMAZON" a "id" (columna bigint NOT NULL), sin agregar un default; a diferencia
-- de `resinas`, que sí tenía su secuencia. `SupabaseMountRepository.insert()` no manda `id`
-- (espera que lo genere la base), así que cualquier alta de armazón quedaba rota.
--
-- La secuencia arranca en el mayor valor existente + 1, no en un número fijo: así sirve igual
-- sobre DEV (hoy) y sobre una copia de PROD en el corte (Fase 5), donde el máximo real es mucho
-- más alto (los IDs viejos de Flutter son números de hasta 17 dígitos al azar). Mismo patrón que
-- `ventas_id_seq` (#10); los valores existentes no se tocan.

create sequence public.armazones_id_seq as bigint owned by public.armazones.id;
select setval(
  'public.armazones_id_seq',
  (select coalesce(max(id), 0) + 1 from public.armazones),
  false
);
alter table public.armazones
  alter column id set default nextval('public.armazones_id_seq');

grant usage, select on sequence public.armazones_id_seq to authenticated, service_role;
