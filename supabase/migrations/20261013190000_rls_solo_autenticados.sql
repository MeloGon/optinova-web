-- Cambio #1: las políticas abiertas dejan de aplicar a `anon` (visitante sin login).
-- Antes: "Policy with security definer functions" -> TO public, USING (true)
--        = cualquiera con la publishable key podía leer/escribir/borrar.
-- Ahora: misma regla, pero solo para `authenticated` (usuario con sesión).
-- Revertir: mismo comando con `to public`.

alter policy "Policy with security definer functions" on public.armazones          to authenticated;
alter policy "Policy with security definer functions" on public.categorias_egresos to authenticated;
alter policy "Policy with security definer functions" on public.egresos            to authenticated;
alter policy "Policy with security definer functions" on public.pacientes          to authenticated;
alter policy "Policy with security definer functions" on public.resinas            to authenticated;
alter policy "Policy with security definer functions" on public.revisiones         to authenticated;
alter policy "Policy with security definer functions" on public.vendedores         to authenticated;
alter policy "Policy with security definer functions" on public.ventas             to authenticated;
alter policy "Policy with security definer functions" on public."ventas cortas"    to authenticated;
