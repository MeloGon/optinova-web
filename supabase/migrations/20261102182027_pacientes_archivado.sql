-- Cambio #11: eliminar/archivar paciente según su historial (decisión del dueño, 2026-10-26).
--
-- Columnas nuevas para "archivar" (= borrado lógico, reversible) un paciente con ventas/pagos,
-- en vez de borrarlo: deja de salir en búsquedas y en Vender, pero conserva su historial y se
-- puede restaurar.
--
-- Además, se le quita a `authenticated` el permiso de DELETE sobre `pacientes` y de UPDATE sobre
-- las columnas nuevas: de ahora en más, borrar o archivar/restaurar un paciente solo lo puede
-- hacer el Edge Function `patients-lifecycle` (con la service_role key), que aplica la regla de
-- niveles (sin relaciones / con medidas / con ventas) en el servidor. Antes, cualquier usuario
-- autenticado podía borrar cualquier paciente directo desde el navegador (RLS "USING (true)" +
-- GRANT ALL de la base, sin mirar el rol ni el historial).
--
-- Las columnas editables desde la app (toColumns() en supabase-patient.repository.ts) se vuelven
-- a conceder explícitamente, así que editar un paciente sigue funcionando igual.

alter table public.pacientes
  add column archivado_en timestamptz,
  add column archivado_por uuid references public.perfiles(id);

create index pacientes_archivado_en_idx on public.pacientes(archivado_en);

revoke delete on public.pacientes from authenticated;

revoke update on public.pacientes from authenticated;
grant update (
  nombre, sucursal, telefono, telefono_secundario, genero, observaciones, fecha_nacimiento
) on public.pacientes to authenticated;
