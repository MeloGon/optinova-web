-- Cambio #5: los IDs de pacientes los asigna la base de datos.
--
-- Antes: Flutter inventaba un número aleatorio de 16 dígitos en el navegador. Podía chocar con otro
--        (la llave primaria lo rechazaba, pero el usuario veía un error) y varios superan los 9e15 que
--        JavaScript puede manejar con exactitud.
-- Ahora: "ID PACIENTE" sale de una secuencia que arranca en el mayor ID existente + 1. La base
--        garantiza que no se repite, ni siquiera si dos personas guardan a la vez. Los IDs viejos no se tocan.
--
-- Sirve igual sobre DEV y sobre una copia de PROD (corte, Fase 5): al aplicarse recoloca la secuencia
-- sobre los datos que haya en ese momento.

create sequence public.pacientes_id_seq as bigint owned by public.pacientes."ID PACIENTE";

-- is_called = false: el próximo nextval devuelve exactamente max + 1 (o 1 si la tabla está vacía).
select setval(
  'public.pacientes_id_seq',
  (select coalesce(max("ID PACIENTE"), 0) + 1 from public.pacientes),
  false
);

alter table public.pacientes
  alter column "ID PACIENTE" set default nextval('public.pacientes_id_seq');

-- Quien inserta (usuarios con sesión) necesita permiso para usar la secuencia.
grant usage, select on sequence public.pacientes_id_seq to authenticated, service_role;
