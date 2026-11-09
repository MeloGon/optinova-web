-- Cambio #30: une las fichas de paciente duplicadas con evidencia fuerte.
--
-- Flutter dejaba registrar a la misma persona varias veces (y se siguen creando en 2026). Aquí se
-- unen SOLO las fichas con el mismo nombre que coinciden en teléfono Y en fecha de nacimiento
-- (36 pares en la copia de PROD del 2026-11-08). Las que coinciden en una sola cosa (teléfono o
-- nacimiento) pueden ser familiares u homónimos y quedan para revisión manual del dueño.
--
-- Sobrevive la ficha con `fecha_registro` más reciente (empate: el id mayor). Las demás se
-- archivan (`archivado_en`, reversible) y sus ventas y revisiones pasan a la sobreviviente.
-- `pacientes_unidos` guarda qué se movió, para poder deshacerlo.
--
-- Se ignoran: nombre vacío, "CLIENTE DE PASO", "PRUEBA", datos de prueba AGY, fichas ya
-- archivadas, nacimientos iguales a la fecha de registro (dato falso) y teléfonos de menos de
-- 7 dígitos. Re-ejecutable: una segunda corrida ya no encuentra fichas activas repetidas.

create table if not exists public.pacientes_unidos (
  id_viejo        bigint primary key,
  id_nuevo        bigint not null references public.pacientes(id),
  ventas_ids      text[] not null default '{}',
  revisiones_ids  bigint[] not null default '{}',
  unido_en        timestamptz not null default now()
);

alter table public.pacientes_unidos enable row level security;
revoke all on public.pacientes_unidos from public, anon, authenticated;

-- Corrección de datos: no debe pasar por las reglas de descuento ni cambiar `creado_por`.
alter table public.ventas disable trigger trg_ventas_descuento;
alter table public.ventas disable trigger trg_ventas_creado_por;

create temp table _unir on commit drop as
with p as (
  select id,
         upper(btrim(regexp_replace(nombre, '\s+', ' ', 'g'))) as n,
         nullif(regexp_replace(coalesce(telefono, ''), '\D', '', 'g'), '') as tel,
         case when fecha_nacimiento is distinct from fecha_registro then fecha_nacimiento end as nac,
         fecha_registro
  from public.pacientes
  where archivado_en is null
    and btrim(coalesce(nombre, '')) <> ''
    and nombre not ilike 'AGY%'
    and upper(btrim(nombre)) not in ('CLIENTE DE PASO', 'PRUEBA')
),
pares as (
  select a.id as a_id, b.id as b_id
  from p a
  join p b on a.n = b.n and a.id < b.id
  where a.tel is not null and length(a.tel) >= 7 and a.tel = b.tel
    and a.nac is not null and a.nac = b.nac
),
-- Componente conexa: la menor id alcanzable (cubre cadenas A-B, B-C).
aristas as (
  select a_id as x, b_id as y from pares
  union select b_id, a_id from pares
),
comp as (
  select x as id, min(m) as comp
  from (
    with recursive r(x, m) as (
      select x, x from aristas
      union
      select a.y, r.m from r join aristas a on a.x = r.x
    )
    select x, m from r
  ) t
  group by x
),
ranked as (
  select c.id, c.comp,
         row_number() over (partition by c.comp order by p.fecha_registro desc nulls last, p.id desc) as pos
  from comp c join p on p.id = c.id
)
select r.id as id_viejo, s.id as id_nuevo
from ranked r
join ranked s on s.comp = r.comp and s.pos = 1
where r.pos > 1;

insert into public.pacientes_unidos (id_viejo, id_nuevo, ventas_ids, revisiones_ids)
select u.id_viejo, u.id_nuevo,
       coalesce((select array_agg(v.id) from public.ventas v where v.paciente_id = u.id_viejo), '{}'),
       coalesce((select array_agg(r.id) from public.revisiones r where r.paciente_id = u.id_viejo), '{}')
from _unir u
on conflict (id_viejo) do nothing;

update public.ventas v
set paciente_id = u.id_nuevo
from _unir u
where v.paciente_id = u.id_viejo;

update public.revisiones r
set paciente_id = u.id_nuevo
from _unir u
where r.paciente_id = u.id_viejo;

update public.pacientes p
set archivado_en = now()
from _unir u
where p.id = u.id_viejo;

alter table public.ventas enable trigger trg_ventas_descuento;
alter table public.ventas enable trigger trg_ventas_creado_por;
