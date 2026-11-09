-- Cambio #27: enlaza revisiones con nombre repetido usando las ventas cercanas.
--
-- El cambio #7 enlazó cada revisión a su paciente por nombre. Las que tienen un nombre repetido
-- (2 o más fichas con el mismo nombre) y no se pudieron desempatar por sucursal y fecha de registro
-- quedaron sin paciente_id: 348 en PROD al 2026-11-08.
--
-- Pista nueva: quien se hace un examen suele comprar lentes pocos días después. Se enlaza una
-- revisión a un candidato cuando SOLO ese candidato tiene una venta a ±45 días de la fecha de la
-- revisión. Medido en DEV con 3,000 revisiones ya enlazadas: el paciente correcto tiene una venta
-- cercana en el 88.2% de los casos y uno al azar en el 5.5% (acierto estimado ~99%).
--
-- NO se enlazan (quedan como están, con el nombre guardado):
--   * Las que parecen ser la MISMA persona registrada dos o más veces (todos los candidatos
--     comparten fecha de nacimiento o teléfono): 123 en PROD. Elegir una ficha dejaría la otra
--     vacía; se resuelve uniendo las fichas duplicadas, decisión del dueño.
--   * Las que no tienen pista segura (ningún candidato con venta cercana, o varios): 57.
--
-- Corre después del #8 (usa ventas.paciente_id). Re-ejecutable: solo toca revisiones sin paciente_id.
-- En el corte (Fase 5) se vuelve a correr sobre una copia fresca de PROD.

-- Es una corrección de datos, no una edición del usuario: updated_at no debe cambiar.
alter table public.revisiones disable trigger trg_revisiones_updated_at;

with ambiguas as (
  select r.id, r.fecha, lower(btrim(r.paciente_nombre)) as nombre
  from public.revisiones r
  where r.paciente_id is null
    and btrim(coalesce(r.paciente_nombre, '')) <> ''
    and exists (
      select 1 from public.pacientes p where lower(btrim(p.nombre)) = lower(btrim(r.paciente_nombre))
    )
),
candidatos as (
  select a.id as revision_id, a.fecha, p.id as paciente_id,
         nullif(btrim(p.telefono), '') as telefono, p.fecha_nacimiento as nacimiento,
         exists (
           select 1 from public.ventas v
           where v.paciente_id = p.id and abs(v.fecha_venta_iso - a.fecha) <= 45
         ) as venta_cercana
  from ambiguas a
  join public.pacientes p on lower(btrim(p.nombre)) = a.nombre
),
por_revision as (
  select revision_id,
         -- Misma persona registrada varias veces: todos comparten nacimiento (sin ninguno vacío) o teléfono.
         (count(distinct nacimiento) filter (where nacimiento is not null) = 1
            and count(*) filter (where nacimiento is null) = 0) as mismo_nacimiento,
         (count(distinct telefono) filter (where telefono is not null) = 1
            and count(*) filter (where telefono is null) = 0) as mismo_telefono,
         count(*) filter (where venta_cercana) as con_venta,
         min(paciente_id) filter (where venta_cercana) as elegido
  from candidatos
  group by revision_id
),
elegidas as (
  select revision_id, elegido
  from por_revision
  where not (mismo_nacimiento or mismo_telefono)
    and con_venta = 1
)
update public.revisiones r
set paciente_id = e.elegido
from elegidas e
where r.id = e.revision_id;

alter table public.revisiones enable trigger trg_revisiones_updated_at;
