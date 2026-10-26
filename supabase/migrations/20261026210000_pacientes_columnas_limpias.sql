-- Cambio #6: columnas de pacientes con nombres limpios (snake_case, sin espacios ni mayúsculas).
--
--   "ID PACIENTE"                 → id
--   "NOMBRE COMPLETO"             → nombre
--   "SUCURSAL"                    → sucursal
--   "TELEFONO CEL"                → telefono             (el que muestra y edita la app)
--   "TELEFONO 1"                  → telefono_secundario  (Flutter nunca lo mostraba)
--   "GENERO"                      → genero
--   "OBSERVACIONES"               → observaciones
--   "COLONIA O LOCALIDAD"         → colonia
--   "DEL O MPIO"                  → municipio
--   "NUMERO DE EMPLEADO"          → numero_empleado
--   "HIPERSENSIBILIDAD A LA LUZ"  → hipersensibilidad_luz
--   "USA DISPOSITIVOS"            → usa_dispositivos
--   DOMICILIO, EMAIL, EMPRESA, IDENTIFICACION, "PERSONALIZADO 1" → en minúsculas
--
-- Teléfonos: en PROD 4,954 pacientes tienen número solo en "TELEFONO 1" y la app no lo mostraba.
-- Ahora telefono toma el celular y, si falta, el otro; si hay dos distintos, el otro queda en
-- telefono_secundario.
--
-- Se eliminan las columnas que están vacías en los 15,259 pacientes de PROD:
-- "ENTIDAD FEDERATIVA", "OCUPACION" y "PERSONALIZADO 2" al "PERSONALIZADO 5".
--
-- Sirve igual sobre DEV y sobre una copia de PROD (corte, Fase 5).

-- Es una corrección de datos, no una edición del usuario: updated_at no debe cambiar.
alter table public.pacientes disable trigger trg_pacientes_updated_at;

alter table public.pacientes rename column "ID PACIENTE" to id;
alter table public.pacientes rename column "NOMBRE COMPLETO" to nombre;
alter table public.pacientes rename column "SUCURSAL" to sucursal;
alter table public.pacientes rename column "TELEFONO CEL" to telefono;
alter table public.pacientes rename column "TELEFONO 1" to telefono_secundario;
alter table public.pacientes rename column "GENERO" to genero;
alter table public.pacientes rename column "OBSERVACIONES" to observaciones;
alter table public.pacientes rename column "DOMICILIO" to domicilio;
alter table public.pacientes rename column "COLONIA O LOCALIDAD" to colonia;
alter table public.pacientes rename column "DEL O MPIO" to municipio;
alter table public.pacientes rename column "EMAIL" to email;
alter table public.pacientes rename column "EMPRESA" to empresa;
alter table public.pacientes rename column "NUMERO DE EMPLEADO" to numero_empleado;
alter table public.pacientes rename column "IDENTIFICACION" to identificacion;
alter table public.pacientes rename column "PERSONALIZADO 1" to personalizado_1;
alter table public.pacientes rename column "USA DISPOSITIVOS" to usa_dispositivos;
alter table public.pacientes rename column "HIPERSENSIBILIDAD A LA LUZ" to hipersensibilidad_luz;

-- Teléfonos: un solo principal; el otro, solo si es distinto.
update public.pacientes
set telefono = btrim(telefono_secundario),
    telefono_secundario = null
where btrim(coalesce(telefono, '')) = ''
  and btrim(coalesce(telefono_secundario, '')) <> '';

update public.pacientes
set telefono_secundario = null
where btrim(coalesce(telefono_secundario, '')) = ''
   or btrim(telefono_secundario) = btrim(telefono);

alter table public.pacientes enable trigger trg_pacientes_updated_at;

-- Columnas que nunca tuvieron datos.
alter table public.pacientes
  drop column "ENTIDAD FEDERATIVA",
  drop column "OCUPACION",
  drop column "PERSONALIZADO 2",
  drop column "PERSONALIZADO 3",
  drop column "PERSONALIZADO 4",
  drop column "PERSONALIZADO 5";

-- La llave primaria ya garantiza que id no se repite: la restricción UNIQUE extra era un índice repetido.
alter table public.pacientes drop constraint if exists "pacientes_ID PACIENTE_key";
