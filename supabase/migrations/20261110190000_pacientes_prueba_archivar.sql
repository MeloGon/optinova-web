-- Cambio #37: archiva los 24 pacientes de prueba que quedaron en PROD (Flutter).
--
-- Son fichas de pruebas del equipo ("CLIENTE DE PRUEBA", "prueba", "SISTEMAS OPTOX...") de 2015 a
-- 2020, con 16 ventas (S/. 1 872) y algunas revisiones. Decisión del dueño (2026-11-09): archivar,
-- no borrar, para que no salgan en la búsqueda pero el historial de ventas siga completo.
--
-- Se archivan por id (la lista se sacó de la copia de PROD del 2026-11-09) y solo si el nombre
-- sigue pareciendo de prueba: si una ficha cambió de dueño o de nombre, no se toca.
-- No pasa por las reglas de ventas ni mueve `updated_at` (corrección de datos).
--
-- Re-ejecutable: ya no encuentra fichas activas en la segunda corrida.

alter table public.pacientes disable trigger user;

update public.pacientes
set archivado_en = now()
where archivado_en is null
  and id in (
    4, 9, 38, 44, 45, 622,
    160806113331, 171011190742445, 171014161304965, 180109182406790, 180407164619965,
    180530181040696, 180719171741696, 180721094059696, 190820172628369, 190821121953466,
    190822212206696, 190823093311466, 190823102122495, 190823112933466, 201012132912369,
    201012133222369, 201012135418369, 201205150418369
  )
  and (upper(nombre) like '%PRUEBA%' or upper(nombre) like '%OPTOX%' or upper(nombre) like '%OTPOX%');

alter table public.pacientes enable trigger user;
