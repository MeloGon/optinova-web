-- Cambio #21: `app_config` solo lo edita admin+ (E2.8, Settings · Features).
--
-- La política "authenticated can update app_config" del baseline dejaba a CUALQUIER usuario con
-- sesión (incluido vendedor) prender/apagar una función de la app directo por la API, sin pasar
-- por la pantalla ni por su rol. La pantalla ya es admin-only por ruta, pero eso es solo del
-- cliente — mismo patrón de hallazgo que `payments_report` (#19). Lectura sigue abierta a
-- cualquier autenticado: toda la app necesita poder leer los flags (ej. Historial de ventas,
-- sin importar el rol de quien lo mira).

drop policy if exists "authenticated can update app_config" on public.app_config;

create policy "admin can update app_config" on public.app_config
  for update to authenticated
  using (
    exists (
      select 1 from public.perfiles
      where id = auth.uid() and rol in ('admin', 'megadmin')
    )
  );
