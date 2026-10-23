-- Cambio #2: un usuario ya no puede modificar su propia fila de `perfiles`.
-- Antes: "own profile update" -> FOR UPDATE USING (id = auth.uid()), sin WITH CHECK
--        = cualquier usuario con sesión podía hacer `update perfiles set rol = 'megadmin'`
--          sobre sí mismo y así usar la Edge Function megadmin-users y pasar la
--          autorización de supervisor (ambas confían en perfiles.rol).
-- Ahora: sin política de UPDATE para el propio usuario. Los cambios de perfil los hace
--        la Edge Function megadmin-users con service_role (no pasa por RLS).
-- La app Flutter nunca actualiza `perfiles` desde el cliente: no se rompe nada.
-- Revertir: create policy "own profile update" on public.perfiles for update using (id = auth.uid());

drop policy if exists "own profile update" on public.perfiles;
