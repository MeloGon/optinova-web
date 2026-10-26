-- Cambio #3: pacientes con fechas de verdad (tipo date, formato ISO).
--
-- Antes:  "FECHA DE REGISTRO" text (formatos mezclados) + fecha_registro_actualizada date
--         "FECHA DE NACIMIENTO" text (dd-mmm-aa, dd-mm-aaaa o vacía)
-- Después: fecha_registro date NOT NULL   (era fecha_registro_actualizada)
--          fecha_nacimiento date NULL     (convertida desde el texto)
--
-- Sirve igual sobre DEV y sobre una copia de PROD (corte, Fase 5): convierte los datos al pasar.

-- Convierte los textos de fecha heredados de Excel. Devuelve NULL si no los entiende.
--   dd-mm-aaaa / dd/mm/aaaa
--   dd-mmm-aa  (mes en español: ene feb mar abr may jun jul ago sep|sept oct nov dic)
-- Año de 2 cifras: 00-26 se lee 20xx y 27-99 se lee 19xx (regla fija, reproducible).
create function pg_temp.parse_fecha_es(txt text) returns date
language plpgsql immutable as $$
declare
  t text := lower(btrim(coalesce(txt, '')));
  m text[];
  mes int;
  yy int;
begin
  if t = '' then
    return null;
  end if;

  m := regexp_match(t, '^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$');
  if m is not null then
    return make_date(m[3]::int, m[2]::int, m[1]::int);
  end if;

  m := regexp_match(t, '^(\d{1,2})-([a-z]+)-(\d{2})$');
  if m is not null then
    mes := case m[2]
      when 'ene' then 1 when 'feb' then 2 when 'mar' then 3 when 'abr' then 4
      when 'may' then 5 when 'jun' then 6 when 'jul' then 7 when 'ago' then 8
      when 'sep' then 9 when 'sept' then 9 when 'oct' then 10 when 'nov' then 11
      when 'dic' then 12
    end;
    if mes is null then
      return null;
    end if;
    yy := m[3]::int;
    return make_date(case when yy <= 26 then 2000 + yy else 1900 + yy end, mes, m[1]::int);
  end if;

  return null;
exception when others then
  return null; -- fecha imposible (31-feb, etc.)
end;
$$;

-- 1) Fecha de nacimiento: columna nueva y conversión.
alter table public.pacientes add column fecha_nacimiento date;

update public.pacientes
set fecha_nacimiento = pg_temp.parse_fecha_es("FECHA DE NACIMIENTO");

-- 2) Fecha de registro: la columna "actualizada" ya era limpia; si faltara, se intenta con el texto.
update public.pacientes
set fecha_registro_actualizada = pg_temp.parse_fecha_es("FECHA DE REGISTRO")
where fecha_registro_actualizada is null;

alter table public.pacientes rename column fecha_registro_actualizada to fecha_registro;
alter index public.pacientes_fecha_registro_actualizada_idx rename to pacientes_fecha_registro_idx;

-- Si quedara alguna fila sin fecha, esto falla a propósito (se ve en el ensayo del corte).
alter table public.pacientes alter column fecha_registro set not null;
alter table public.pacientes alter column fecha_registro set default current_date;

-- 3) Se eliminan los textos heredados.
alter table public.pacientes drop column "FECHA DE REGISTRO";
alter table public.pacientes drop column "FECHA DE NACIMIENTO";

-- 4) Momento exacto (UTC) de creación y de última modificación.
--    Los pacientes que ya existen quedan en NULL: no se inventa una hora que no se guardó.
alter table public.pacientes add column created_at timestamptz;
alter table public.pacientes add column updated_at timestamptz;
alter table public.pacientes alter column created_at set default now();

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_pacientes_updated_at
before update on public.pacientes
for each row execute function public.set_updated_at();
