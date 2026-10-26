-- Cambio #4: pacientes."GENERO" con valores fijos.
--
-- PROD mezcla cuatro formas (H, M, Masculino, Femenino) y vacíos. Se unifica a
--   'Masculino' | 'Femenino' | 'Otro' | NULL (sin especificar)
-- H = Hombre → Masculino · M = Mujer → Femenino (confirmado por el dueño, 2026-10-26).
--
-- Sirve igual sobre DEV y sobre una copia de PROD (corte, Fase 5).

-- Es una corrección de datos, no una edición del usuario: updated_at no debe cambiar.
alter table public.pacientes disable trigger trg_pacientes_updated_at;

update public.pacientes
set "GENERO" = case upper(btrim(coalesce("GENERO", '')))
  when 'H' then 'Masculino'
  when 'MASCULINO' then 'Masculino'
  when 'M' then 'Femenino'
  when 'FEMENINO' then 'Femenino'
  when 'OTRO' then 'Otro'
  else null
end;

alter table public.pacientes enable trigger trg_pacientes_updated_at;

-- Si algún valor no entró en el CASE queda en NULL; la verificación del corte lo cuenta.
alter table public.pacientes
  add constraint pacientes_genero_check
  check ("GENERO" in ('Masculino', 'Femenino', 'Otro'));
