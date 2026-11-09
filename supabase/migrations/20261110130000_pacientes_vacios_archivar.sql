-- Cambio #31: archiva las fichas de paciente sin nombre y sin historial.
--
-- En la copia de PROD del 2026-11-08 hay 156 fichas con el nombre vacío, todas de OFTALVISION
-- (2015 a 2025). 139 no tienen ventas ni revisiones: no sirven y solo ensucian la lista. Las 17
-- restantes tienen 21 ventas históricas (también sin nombre) y no se tocan.
--
-- Se archivan (`archivado_en`, reversible), no se borran. Re-ejecutable: solo toca fichas activas.

update public.pacientes p
set archivado_en = now()
where p.archivado_en is null
  and btrim(coalesce(p.nombre, '')) = ''
  and not exists (select 1 from public.ventas v where v.paciente_id = p.id)
  and not exists (select 1 from public.revisiones r where r.paciente_id = p.id);
