-- Cambio #28: enlaza a su paciente las ventas que Flutter dejó sin id de paciente.
--
-- Desde mediados de septiembre de 2025 Flutter dejó de guardar el id del paciente en las ventas
-- (`paciente_id_legado` queda vacío): 1,807 ventas en la copia de PROD del 2026-11-08, 1,579 de
-- 2026. El #8 solo pudo enlazar las que traían el id, así que estas no aparecen en la ficha del
-- paciente (ni sus abonos).
--
-- Criterio, el mismo que el #7 aceptó para las revisiones: se enlaza por nombre cuando hay UNA sola
-- ficha con ese nombre. Solo ventas sin ningún id guardado (no las que traían un id de un paciente
-- que luego se borró: esas no se tocan).
--
-- No se enlazan (quedan con su nombre): 116 ventas con nombre repetido y 28 sin ninguna ficha con
-- ese nombre. 326 de las enlazadas tienen la ficha registrada unos días DESPUÉS de la fecha de la
-- venta (casi siempre 1 a 4 días), compatible con ventas cuya fecha se corrigió a mano.
--
-- Corre después del #8. Re-ejecutable: solo toca ventas sin paciente_id.

-- Es una corrección de datos: no debe pasar por las reglas de descuento ni cambiar `creado_por`.
alter table public.ventas disable trigger trg_ventas_descuento;
alter table public.ventas disable trigger trg_ventas_creado_por;

with sin_id as (
  select v.id, lower(btrim(v.paciente_nombre)) as nombre
  from public.ventas v
  where v.paciente_id is null
    and btrim(coalesce(v.paciente_nombre, '')) <> ''
    and btrim(coalesce(v.paciente_id_legado, '')) = ''
),
unicos as (
  select s.id as venta_id, min(p.id) as paciente_id
  from sin_id s
  join public.pacientes p on lower(btrim(p.nombre)) = s.nombre
  group by s.id
  having count(*) = 1
)
update public.ventas v
set paciente_id = u.paciente_id
from unicos u
where v.id = u.venta_id;

alter table public.ventas enable trigger trg_ventas_descuento;
alter table public.ventas enable trigger trg_ventas_creado_por;
