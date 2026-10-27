-- Cambio #7: columnas de revisiones con nombres limpios, fecha como date, ID por secuencia
-- y FK a pacientes (nombre histórico como respaldo).
--
--   "ID REFRACCION"            → id (secuencia, igual que pacientes en el cambio #5)
--   "PACIENTE"                 → paciente_nombre (respaldo; ya no es la forma de enlazar)
--   "FECHA" (texto, se borra)  → se reemplaza por "fecha" = fecha_revision_actualizada (ya era date
--                                 y está llena en las 17,331 filas de PROD; el texto es solo una
--                                 versión para mostrar, en español y con formato variable)
--   "MOTIVO DE CONSULTA"       → motivo_consulta
--   "HISTORIA CLINICA"         → historia_clinica
--   "OD/OI ESF/CIL/EJE/AV"     → od_esf, od_cil, od_eje, od_av, oi_esf, oi_cil, oi_eje, oi_av
--   "ADD"                      → adicion (ADD no es palabra reservada, pero "adición" es el término
--                                 óptico en español)
--   "OBSERVACIONES"            → observaciones
--   "DIP"                      → dip
--   "SUCURSAL"                 → sucursal
--   "OD/OI CB LC", "OD/OI DIAM LC" → od_cb_lc, od_diam_lc, oi_cb_lc, oi_diam_lc
--   "TIPO DE GRADUACION"       → tipo_graduacion
--   "AV SIN RX OD/OI LEJOS"    → av_sin_rx_od_lejos, av_sin_rx_oi_lejos
--   "CV OD/OI LEJOS"           → cv_od_lejos, cv_oi_lejos
--   "AV SIN RX OD/OI CERCA"    → av_sin_rx_od_cerca, av_sin_rx_oi_cerca
--   "AV CON RX OD/OI CERCA"    → av_con_rx_od_cerca, av_con_rx_oi_cerca
--   "DIAGNOSTICO OPTOMETRICO"  → diagnostico_optometrico
--
-- Nuevo: paciente_id (FK a pacientes.id), created_at, updated_at (trigger, reutiliza
-- public.set_updated_at() del cambio #3).
--
-- paciente_id se rellena en dos pasadas (decisión del dueño, 2026-10-26):
--   1) Nombre único: la revisión tiene exactamente un paciente con ese nombre → se enlaza directo.
--   2) Nombre repetido: se filtra por misma sucursal y paciente registrado antes (o el mismo día)
--      de la consulta; si con ese filtro queda un solo candidato, se enlaza. Si siguen siendo varios,
--      o no hay ninguno, o la revisión no tiene nombre, paciente_id queda NULL para revisión manual.
-- Sobre los 17,331 de PROD esto deja aproximadamente 16,503 enlazados directo, 357 por sucursal+fecha
-- y ~470 pendientes (366 ambiguos, 42 sin paciente, 62 sin nombre). En PROD no se aplica todavía: esta
-- migración corre sobre DEV; el corte (Fase 5) la vuelve a correr sobre una copia fresca de PROD.

alter table public.revisiones rename column "ID REFRACCION" to id;
alter table public.revisiones rename column "PACIENTE" to paciente_nombre;
alter table public.revisiones rename column "MOTIVO DE CONSULTA" to motivo_consulta;
alter table public.revisiones rename column "HISTORIA CLINICA" to historia_clinica;
alter table public.revisiones rename column "OD ESF" to od_esf;
alter table public.revisiones rename column "OD CIL" to od_cil;
alter table public.revisiones rename column "OD EJE" to od_eje;
alter table public.revisiones rename column "OD AV" to od_av;
alter table public.revisiones rename column "OI ESF" to oi_esf;
alter table public.revisiones rename column "OI CIL" to oi_cil;
alter table public.revisiones rename column "OI EJE" to oi_eje;
alter table public.revisiones rename column "OI AV" to oi_av;
alter table public.revisiones rename column "ADD" to adicion;
alter table public.revisiones rename column "OBSERVACIONES" to observaciones;
alter table public.revisiones rename column "DIP" to dip;
alter table public.revisiones rename column "SUCURSAL" to sucursal;
alter table public.revisiones rename column "OD CB LC" to od_cb_lc;
alter table public.revisiones rename column "OD DIAM LC" to od_diam_lc;
alter table public.revisiones rename column "OI CB LC" to oi_cb_lc;
alter table public.revisiones rename column "OI DIAM LC" to oi_diam_lc;
alter table public.revisiones rename column "TIPO DE GRADUACION" to tipo_graduacion;
alter table public.revisiones rename column "AV SIN RX OD LEJOS" to av_sin_rx_od_lejos;
alter table public.revisiones rename column "AV SIN RX OI LEJOS" to av_sin_rx_oi_lejos;
alter table public.revisiones rename column "CV OD LEJOS" to cv_od_lejos;
alter table public.revisiones rename column "CV OI LEJOS" to cv_oi_lejos;
alter table public.revisiones rename column "AV SIN RX OD CERCA" to av_sin_rx_od_cerca;
alter table public.revisiones rename column "AV SIN RX OI CERCA" to av_sin_rx_oi_cerca;
alter table public.revisiones rename column "AV CON RX OD CERCA" to av_con_rx_od_cerca;
alter table public.revisiones rename column "AV CON RX OI CERCA" to av_con_rx_oi_cerca;
alter table public.revisiones rename column "DIAGNOSTICO OPTOMETRICO" to diagnostico_optometrico;

-- "FECHA" es texto en español con formato variable (dd-MMM-yyyy); fecha_revision_actualizada ya
-- es date y está llena en todas las filas (verificado en DEV y PROD): se vuelve la fecha real.
alter table public.revisiones drop column "FECHA";
alter table public.revisiones rename column fecha_revision_actualizada to fecha;
alter table public.revisiones alter column fecha set not null;
alter table public.revisiones alter column fecha set default current_date;

-- ID por secuencia (igual que pacientes en el cambio #5): arranca en el mayor ID existente + 1.
create sequence public.revisiones_id_seq as bigint owned by public.revisiones.id;

select setval(
  'public.revisiones_id_seq',
  (select coalesce(max(id), 0) + 1 from public.revisiones),
  false
);

alter table public.revisiones
  alter column id set default nextval('public.revisiones_id_seq');

grant usage, select on sequence public.revisiones_id_seq to authenticated, service_role;

-- FK a pacientes; paciente_nombre queda como respaldo y ya no se usa para enlazar.
alter table public.revisiones add column paciente_id bigint references public.pacientes(id);

-- Paso 1: nombre único entre los pacientes.
with candidatos as (
  select r.id as revision_id, p.id as paciente_id
  from public.revisiones r
  join public.pacientes p
    on lower(btrim(p.nombre)) = lower(btrim(r.paciente_nombre))
  where btrim(coalesce(r.paciente_nombre, '')) <> ''
),
unicos as (
  select revision_id, min(paciente_id) as paciente_id
  from candidatos
  group by revision_id
  having count(*) = 1
)
update public.revisiones r
set paciente_id = u.paciente_id
from unicos u
where r.id = u.revision_id;

-- Paso 2: nombre repetido, se filtra por sucursal y por paciente ya registrado cuando se hizo la
-- consulta; solo se enlaza si con ese filtro queda un único candidato.
with candidatos as (
  select r.id as revision_id, p.id as paciente_id
  from public.revisiones r
  join public.pacientes p
    on lower(btrim(p.nombre)) = lower(btrim(r.paciente_nombre))
   and p.sucursal = r.sucursal
   and p.fecha_registro <= r.fecha
  where r.paciente_id is null
    and btrim(coalesce(r.paciente_nombre, '')) <> ''
),
unicos as (
  select revision_id, min(paciente_id) as paciente_id
  from candidatos
  group by revision_id
  having count(*) = 1
)
update public.revisiones r
set paciente_id = u.paciente_id
from unicos u
where r.id = u.revision_id;

create index revisiones_paciente_id_idx on public.revisiones(paciente_id);

-- Momento de creación y última modificación (igual que pacientes, cambio #3).
alter table public.revisiones add column created_at timestamptz;
alter table public.revisiones add column updated_at timestamptz;
alter table public.revisiones alter column created_at set default now();

create trigger trg_revisiones_updated_at
before update on public.revisiones
for each row execute function public.set_updated_at();
