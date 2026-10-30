-- =============================================================================
-- Datos de PRUEBA para optinova-db (DEV). Todo es ficticio.
-- Re-ejecutable: borra los datos de prueba y los vuelve a crear.
--
-- Usuarios de prueba (password para todos: OptinovaDev2026):
--   megadmin@optinova.test    rol megadmin   (OFTALVISION)
--   admin@optinova.test       rol admin      (OFTALVISION)
--   supervisor@optinova.test  rol supervisor (MEDILENT)
--   vendedor@optinova.test    rol vendedor   (MEDILENT)
--
-- Formatos de texto que espera la app (heredados de Flutter):
--   pacientes.fecha_registro / fecha_nacimiento  date (yyyy-MM-dd); migración #3
--   revisiones."FECHA"              dd-MMM-yyyy es
--   ventas.fecha_legado / venta_items.fecha_venta_legado   dd-MMM-yy en (13-Oct-26); migración #8
--   columnas *_actualizada / *_iso  date (yyyy-MM-dd)
-- =============================================================================

select setseed(0.2026);

-- Limpieza (orden por llaves foráneas) ----------------------------------------
delete from public.pagos;
delete from public.venta_items;
delete from public.ventas;
delete from public.revisiones;
delete from public.pacientes;
delete from public.armazones;
delete from public.resinas;
delete from public.vendedores;
delete from public.egresos;
delete from public.categorias_egresos;
delete from public.app_config;
delete from auth.users where email like '%@optinova.test';  -- cascada a perfiles/identities
-- audit_logs es append-only por diseño; en DEV se limpia como postgres.
delete from public.audit_logs;

-- Helpers de fecha -------------------------------------------------------------
create or replace function pg_temp.fecha_es(d date) returns text language sql immutable as $$
  select to_char(d, 'DD') || '-' ||
         (array['ene','feb','mar','abr','may','jun','jul','ago','sept','oct','nov','dic'])[extract(month from d)::int]
         || '-' || to_char(d, 'YYYY')
$$;
create or replace function pg_temp.fecha_en(d date) returns text language sql immutable as $$
  select to_char(d, 'DD') || '-' ||
         (array['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'])[extract(month from d)::int]
         || '-' || to_char(d, 'YY')
$$;
create or replace function pg_temp.pick(arr text[]) returns text language sql volatile as $$
  select arr[1 + floor(random() * array_length(arr, 1))::int]
$$;

-- Usuarios de prueba -------------------------------------------------------------
-- El trigger on_auth_user_created crea su fila en perfiles con rol 'vendedor'.
with u(id, email) as (
  values
    ('11111111-1111-4111-8111-111111111111'::uuid, 'megadmin@optinova.test'),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'admin@optinova.test'),
    ('33333333-3333-4333-8333-333333333333'::uuid, 'supervisor@optinova.test'),
    ('44444444-4444-4444-8444-444444444444'::uuid, 'vendedor@optinova.test')
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
       extensions.crypt('OptinovaDev2026', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now(),
       '', '', '', ''
from u;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, 'email',
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       now(), now(), now()
from auth.users where email like '%@optinova.test';

update public.perfiles p set nombre = v.nombre, sucursal = v.sucursal, rol = v.rol
from (values
  ('11111111-1111-4111-8111-111111111111'::uuid, 'Mega Admin Prueba', 'OFTALVISION', 'megadmin'),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'Admin Prueba',      'OFTALVISION', 'admin'),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'Supervisor Prueba', 'MEDILENT',    'supervisor'),
  ('44444444-4444-4444-8444-444444444444'::uuid, 'Vendedor Prueba',   'MEDILENT',    'vendedor')
) as v(id, nombre, sucursal, rol)
where p.id = v.id;

-- Catálogos ----------------------------------------------------------------------
insert into public.app_config (key, value, description) values
  ('feature_change_date', 'true', 'Permite cambiar la fecha de una venta desde el historial');

insert into public.categorias_egresos (nombre, color) values
  ('Compra de inventario', '#6366F1'),
  ('Gastos operativos',    '#F59E0B'),
  ('Caja chica',           '#10B981');

insert into public.vendedores ("NOMBRE")
select unnest(array['ANA LOPEZ','CARLOS RUIZ','MARIA TORRES','JORGE DIAZ','LUCIA MORA','PEDRO SALAS','SOFIA VEGA','DIEGO ROJAS']);

insert into public.resinas (descripcion, "diseño", linea, material, tecnologia, texto, cantidad, precio, precio_interno)
select 'RESINA PRUEBA ' || g,
       pg_temp.pick(array['MONOFOCAL','BIFOCAL','PROGRESIVO','OCUPACIONAL']),
       pg_temp.pick(array['ESTANDAR','PREMIUM','DIGITAL']),
       pg_temp.pick(array['CR-39','POLICARBONATO','ALTO INDICE 1.67','TRIVEX']),
       pg_temp.pick(array['ANTIRREFLEJANTE','BLUE CUT','FOTOCROMATICO','SIN TRATAMIENTO']),
       'Texto de prueba ' || g,
       (1 + floor(random() * 20))::smallint,
       round((300 + random() * 2700)::numeric, 0),
       round((150 + random() * 1200)::numeric, 0)
from generate_series(1, 50) g;

insert into public.armazones ("ID ARMAZON", "MARCA", "MODELO", "COLOR", "DESCRIPCION", "PRECIO",
  "NOMBRE DE LA OPTICA", "FECHA DE REGISTRO", "CODIGO DE BARRAS", "EXISTENCIAS", "PROVEEDOR", "CONSIGNACION")
select 900000 + g,
       pg_temp.pick(array['RAY-BAN','OAKLEY','VOGUE','CARRERA','GUESS','POLICE','TOMMY']),
       'MOD-' || lpad(g::text, 3, '0'),
       pg_temp.pick(array['NEGRO','CAREY','AZUL','DORADO','PLATA','ROJO']),
       pg_temp.pick(array['ACETATO COMPLETO','METAL AL AIRE','RANURADO','INFANTIL']),
       round((500 + random() * 3500)::numeric, 0),
       pg_temp.pick(array['OFTALVISION','MEDILENT']),
       to_char(current_date - (random() * 365)::int, 'DD-MM-YYYY'),
       '75000' || lpad(g::text, 8, '0'),
       floor(random() * 10)::smallint,
       pg_temp.pick(array['PROVEEDOR A','PROVEEDOR B','PROVEEDOR C']),
       'FALSO'
from generate_series(1, 50) g;

-- Pacientes y revisiones -----------------------------------------------------------
drop table if exists pg_temp.seed_pacientes;
create temp table seed_pacientes as
select g,
       (1000000000000000 + g)::bigint as id,
       pg_temp.pick(array['JUAN','MARIA','LUIS','ANA','JOSE','ROSA','PEDRO','LAURA','MIGUEL','CARMEN','JAVIER','ELENA'])
         || ' ' || pg_temp.pick(array['GARCIA','MARTINEZ','LOPEZ','SANCHEZ','PEREZ','GOMEZ','FLORES','RAMIREZ','CRUZ','REYES'])
         || ' ' || pg_temp.pick(array['HERNANDEZ','JIMENEZ','RUIZ','MORALES','ORTIZ','CASTRO','VARGAS','MENDOZA'])
         || ' PRUEBA ' || g as nombre,
       current_date - (random() * 365)::int as registro,
       date '1950-01-01' + (random() * 25000)::int as nacimiento,
       pg_temp.pick(array['OFTALVISION','MEDILENT']) as sucursal
from generate_series(1, 50) g;

insert into public.pacientes (id, sucursal, nombre,
  telefono, genero, observaciones, fecha_registro, fecha_nacimiento)
select id, sucursal, nombre,
       '555' || lpad((floor(random() * 10000000))::text, 7, '0'),
       pg_temp.pick(array['Masculino','Femenino']),
       'PACIENTE DE PRUEBA',
       registro,
       nacimiento
from seed_pacientes;

-- Los pacientes del seed llevan ID explícito: la secuencia debe seguir después del mayor.
select setval('public.pacientes_id_seq', (select coalesce(max(id), 0) + 1 from public.pacientes), false);

insert into public.revisiones ("ID REFRACCION", "PACIENTE", "FECHA", "MOTIVO DE CONSULTA", "HISTORIA CLINICA",
  "OD ESF", "OD CIL", "OD EJE", "OD AV", "OI ESF", "OI CIL", "OI EJE", "OI AV", "ADD", "OBSERVACIONES", "DIP",
  "SUCURSAL", fecha_revision_actualizada)
select 1000000000000 + p.g, p.nombre, pg_temp.fecha_es(p.registro + 1),
       pg_temp.pick(array['VISION BORROSA','REVISION ANUAL','DOLOR DE CABEZA','CAMBIO DE LENTES']),
       'Sin antecedentes relevantes',
       to_char(-4 + floor(random() * 33) * 0.25, 'FMS0.00'), to_char(-floor(random() * 9) * 0.25, 'FM0.00'),
       (floor(random() * 18) * 10)::text, '20/' || pg_temp.pick(array['20','25','30','40']),
       to_char(-4 + floor(random() * 33) * 0.25, 'FMS0.00'), to_char(-floor(random() * 9) * 0.25, 'FM0.00'),
       (floor(random() * 18) * 10)::text, '20/' || pg_temp.pick(array['20','25','30','40']),
       pg_temp.pick(array['','+1.00','+1.50','+2.00']),
       'Revisión de prueba', (58 + floor(random() * 10))::text,
       p.sucursal, p.registro + 1
from seed_pacientes p;

-- Ventas, detalle y pagos ----------------------------------------------------------
drop table if exists pg_temp.seed_ventas;
create temp table seed_ventas as
select s.n as g,
       (10000000000000000 + s.n)::text as id_remision,
       (100000 + s.n)::text as folio,
       current_date - (random() * 90)::int as fecha,
       p.nombre as paciente,
       p.sucursal,
       pg_temp.pick(array['ANA LOPEZ','CARLOS RUIZ','MARIA TORRES','JORGE DIAZ','LUCIA MORA']) as autor,
       r.precio as precio_resina,
       a."PRECIO" as precio_armazon,
       r.id_oftalmico, r.descripcion, r."diseño", r.linea, r.material, r.tecnologia, r.texto,
       a."ID ARMAZON", a."MARCA", a."MODELO", a."COLOR", a."DESCRIPCION" as arm_desc,
       (random() < 0.3) as con_descuento,
       random()::numeric as pct_pagado
from generate_series(1, 50) as s(n)
join seed_pacientes p on p.g = s.n
join lateral (select * from public.resinas order by random() + s.n * 0 limit 1) r on true
join lateral (select * from public.armazones order by random() + s.n * 0 limit 1) a on true;

insert into public.ventas (id, sucursal, fecha_legado, folio, paciente_nombre, autor_nombre,
  total, descuento, total_con_descuento, a_cuenta, resta, motivo_descuento,
  fecha_actualizada, fecha_venta_iso)
select id_remision, sucursal, pg_temp.fecha_en(fecha), folio, paciente, autor,
       t.total, t.descuento, t.total - t.descuento,
       round((t.total - t.descuento) * pct_pagado, 0),
       (t.total - t.descuento) - round((t.total - t.descuento) * pct_pagado, 0),
       case when con_descuento then 'Descuento especial' end,
       fecha, fecha
from seed_ventas v,
     lateral (select precio_resina + precio_armazon as total,
                     case when con_descuento then round((precio_resina + precio_armazon) * 0.10, 0) else 0 end as descuento) t;

-- Una línea de resina y una de armazón por venta.
insert into public.venta_items (id, venta_id, folio_venta, fecha_venta_legado, paciente_nombre, id_oftalmico,
  descripcion, diseno, linea, material, tecnologia, texto, cantidad, precio, fecha_ventas_actualizada)
select 20000000000000000 + g, id_remision, folio, pg_temp.fecha_en(fecha), paciente, id_oftalmico,
       descripcion, "diseño", linea, material, tecnologia, texto, '1', precio_resina, fecha
from seed_ventas;

insert into public.venta_items (id, venta_id, folio_venta, fecha_venta_legado, paciente_nombre, id_oftalmico,
  id_montura, montura_marca, montura_modelo, montura_color, montura_cantidad, montura_precio,
  montura_texto, fecha_ventas_actualizada)
select 30000000000000000 + g, id_remision, folio, pg_temp.fecha_en(fecha), paciente, "ID ARMAZON",
       "ID ARMAZON", "MARCA", "MODELO", "COLOR", '1', precio_armazon, arm_desc, fecha
from seed_ventas;

-- Pago inicial (nueva_venta) cuando hubo anticipo.
insert into public.pagos (id_remision, monto, fecha_pago, metodo_pago, registrado_por, notas, tipo_pago)
select v.id, v.a_cuenta, v.fecha_venta_iso,
       pg_temp.pick(array['efectivo','tarjeta','transferencia','yape']),
       '44444444-4444-4444-8444-444444444444', 'Pago inicial de venta', 'nueva_venta'
from public.ventas v
where v.a_cuenta > 0;

-- Un abono posterior en algunas ventas con saldo.
insert into public.pagos (id_remision, monto, fecha_pago, metodo_pago, registrado_por, notas, tipo_pago)
select v.id, round(v.resta / 2, 0), least(v.fecha_venta_iso + 7, current_date),
       pg_temp.pick(array['efectivo','transferencia']),
       '33333333-3333-4333-8333-333333333333', 'Abono de prueba', 'abono_saldo'
from public.ventas v
where v.resta > 100 and random() < 0.5;

-- Egresos --------------------------------------------------------------------------
insert into public.egresos (fecha, categoria_id, descripcion, monto, metodo_pago, sucursal, registrado_por, notas)
select current_date - (random() * 90)::int,
       (select id from public.categorias_egresos order by random() + g * 0 limit 1),
       pg_temp.pick(array['Compra de micas','Papelería','Limpieza','Pago de luz','Mensajería','Café y agua']),
       round((50 + random() * 3000)::numeric, 0),
       pg_temp.pick(array['efectivo','otro']),
       pg_temp.pick(array['OFTALVISION','MEDILENT']),
       'admin@optinova.test',
       'Egreso de prueba ' || g
from generate_series(1, 50) g;

drop table if exists pg_temp.seed_pacientes;
drop table if exists pg_temp.seed_ventas;
