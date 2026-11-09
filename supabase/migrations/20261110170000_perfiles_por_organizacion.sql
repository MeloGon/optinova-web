-- Cambio #35: multi-empresa, paso 2c. Los perfiles nacen en la organización que se les indica.
--
-- Hasta hoy `perfiles.organizacion_id` tenía por DEFAULT "Inversiones Oftalvision": cualquier alta
-- de usuario caía en esa empresa. Ahora:
--   - `handle_new_user` toma la organización de `raw_user_meta_data.organizacion_id` (la Edge Function
--     `megadmin-users` la manda al crear el usuario). Sin ese dato la creación falla en vez de
--     adivinar una empresa.
--   - Se quita el DEFAULT de `perfiles.organizacion_id`.
--   - Se elimina la política "admin all perfiles" (`jwt_role() = 'admin'`): daba lectura y escritura
--     de TODOS los perfiles a cualquier admin sin mirar la empresa. Ninguna cuenta la usa (lee
--     `app_metadata.role`, que nadie tiene); el front lee su perfil con "own profile read" y el resto
--     pasa por las RPC y las Edge Functions.
--
-- Re-ejecutable.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  insert into public.perfiles (id, rol, organizacion_id)
  values (new.id, 'vendedor', nullif(new.raw_user_meta_data ->> 'organizacion_id', '')::uuid);
  return new;
end;
$$;

alter table public.perfiles alter column organizacion_id drop default;

drop policy if exists "admin all perfiles" on public.perfiles;
