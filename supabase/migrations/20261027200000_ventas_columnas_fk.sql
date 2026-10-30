-- Cambio #8: renombra las tablas de ventas para que el nombre diga lo que son, limpia sus
-- columnas (snake_case, sin espacios ni mayúsculas) y agrega paciente_id (FK a pacientes).
--
-- Antes la venta/remisión completa vivía en "ventas cortas" (resumen) y cada producto vendido
-- en "ventas" (plural, pero es el detalle línea por línea): al revés de lo esperado.
-- Ahora:
--   ventas      = la venta/remisión (antes "ventas cortas"; = SalesModel de Flutter)
--   venta_items = cada línea vendida dentro de una venta (antes "ventas";  = SalesDetailsModel;
--                 si viniera de Flutter/freezed sería una Sale con su List<SaleItem>)
--
-- "ventas" (detalle) se mueve primero a venta_items para liberar el nombre "ventas".

alter table public.ventas rename to venta_items;
alter table public."ventas cortas" rename to ventas;

-- ventas (la venta/remisión) -------------------------------------------------------------------
--   "SUCURSAL"                        → sucursal
--   "ID REMISION" (ya es PK)          → id
--   "FECHA" (texto, formato variable) → fecha_legado (respaldo; la fecha real sigue en
--                                        fecha_actualizada/fecha_venta_iso, que ya eran date)
--   "FOLIO REMISION"                  → folio
--   "ID PACIENTE"                     → paciente_id_legado (texto; el valor ya es el id real de
--                                        pacientes, a diferencia de revisiones que solo tenía el
--                                        nombre: se castea y enlaza directo, sin ambigüedad)
--   "PACIENTE"                        → paciente_nombre (respaldo)
--   "AUTOR NOMBRE"/"AUTOR APELLIDOS"  → autor_nombre / autor_apellidos
--   "TOTAL"/"DESCUENTO"/...           → total / descuento / total_con_descuento / a_cuenta / resta
--   "MOTIVO DEL DESCUENTO"            → motivo_descuento
--   "NUMERO DE PARCIALIDADES"         → numero_parcialidades
--   "MONTO DEL DESCUENTO VIA NOMINA"  → monto_descuento_nomina
alter table public.ventas rename column "SUCURSAL" to sucursal;
alter table public.ventas rename column "ID REMISION" to id;
alter table public.ventas rename column "FECHA" to fecha_legado;
alter table public.ventas rename column "FOLIO REMISION" to folio;
alter table public.ventas rename column "ID PACIENTE" to paciente_id_legado;
alter table public.ventas rename column "PACIENTE" to paciente_nombre;
alter table public.ventas rename column "AUTOR NOMBRE" to autor_nombre;
alter table public.ventas rename column "AUTOR APELLIDOS" to autor_apellidos;
alter table public.ventas rename column "TOTAL" to total;
alter table public.ventas rename column "DESCUENTO" to descuento;
alter table public.ventas rename column "TOTAL CON DESCUENTO" to total_con_descuento;
alter table public.ventas rename column "A CUENTA" to a_cuenta;
alter table public.ventas rename column "RESTA" to resta;
alter table public.ventas rename column "MOTIVO DEL DESCUENTO" to motivo_descuento;
alter table public.ventas rename column "NUMERO DE PARCIALIDADES" to numero_parcialidades;
alter table public.ventas rename column "MONTO DEL DESCUENTO VIA NOMINA" to monto_descuento_nomina;

-- FK real a pacientes. "ID PACIENTE" ya trae el id correcto (lo asigna la DB desde el cambio #5
-- y Flutter lo guarda al vender); solo se enlaza cuando el texto es numérico y existe ese paciente.
-- En DEV (datos de prueba) no hay ninguna fila con el dato puesto: no enlaza nada todavía, pero
-- corre igual sobre la copia fresca de PROD en el corte (Fase 5).
alter table public.ventas add column paciente_id bigint references public.pacientes(id);

update public.ventas v
set paciente_id = v.paciente_id_legado::bigint
where v.paciente_id_legado ~ '^[0-9]+$'
  and exists (select 1 from public.pacientes p where p.id = v.paciente_id_legado::bigint);

create index ventas_paciente_id_idx on public.ventas(paciente_id);

-- venta_items (las líneas de cada venta) -------------------------------------------------------
--   "ID"                 → id (PK)
--   "ID REMISION"         → venta_id (FK a ventas.id)
--   "FOLIO DE VENTA"      → folio_venta
--   "FECHA DE VENTA"      → fecha_venta_legado (texto; respaldo, igual criterio que fecha_legado)
--   "PACIENTE"            → paciente_nombre
--   "ID OFTALMICO"        → id_oftalmico · "ID MONTURA" → id_montura (sin FK: resinas/armazones
--                           quedan para su propio entregable)
--   "DISEÑO"              → diseno (sin tilde, por la convención de columnas)
--   el resto, igual criterio: minúsculas, sin espacios
alter table public.venta_items rename column "ID" to id;
alter table public.venta_items rename column "ID REMISION" to venta_id;
alter table public.venta_items rename column "FOLIO DE VENTA" to folio_venta;
alter table public.venta_items rename column "FECHA DE VENTA" to fecha_venta_legado;
alter table public.venta_items rename column "PACIENTE" to paciente_nombre;
alter table public.venta_items rename column "ID OFTALMICO" to id_oftalmico;
alter table public.venta_items rename column "DESCRIPCION" to descripcion;
alter table public.venta_items rename column "DISEÑO" to diseno;
alter table public.venta_items rename column "LINEA" to linea;
alter table public.venta_items rename column "MATERIAL" to material;
alter table public.venta_items rename column "TECNOLOGIA" to tecnologia;
alter table public.venta_items rename column "SERIE" to serie;
alter table public.venta_items rename column "TEXTO" to texto;
alter table public.venta_items rename column "CANTIDAD" to cantidad;
alter table public.venta_items rename column "PRECIO" to precio;
alter table public.venta_items rename column "ID MONTURA" to id_montura;
alter table public.venta_items rename column "MONTURA" to montura;
alter table public.venta_items rename column "MONTURA MARCA" to montura_marca;
alter table public.venta_items rename column "MONTURA MODELO" to montura_modelo;
alter table public.venta_items rename column "MONTURA COLOR" to montura_color;
alter table public.venta_items rename column "MONTURA CANTIDAD" to montura_cantidad;
alter table public.venta_items rename column "MONTURA PRECIO" to montura_precio;
alter table public.venta_items rename column "MONTURA TEXTO" to montura_texto;

-- Sin huérfanos en DEV (verificado antes de esta migración): se puede exigir la FK.
alter table public.venta_items add constraint venta_items_venta_id_fkey
  foreign key (venta_id) references public.ventas(id);

-- Funciones de auditoría: el rename de columna no reescribe el texto de las funciones
-- (plpgsql no se vincula por nombre de columna en tiempo de creación), así que hay que
-- actualizarlas a mano con los nombres nuevos. Los triggers (trg_audit_sale, trg_audit_sale_date)
-- siguen apuntando a la misma tabla y columna por OID: no hace falta recrearlos.
create or replace function "public"."audit_log_sale"() returns "trigger"
    language "plpgsql" security definer
    set "search_path" to 'public', 'auth'
    as $$
begin
  if (TG_OP = 'INSERT') then
    insert into public.audit_logs(action, entity, entity_id, user_email, detail)
    values (
      'create_sale', 'sale', NEW.folio, audit_actor_email(),
      jsonb_build_object(
        'folio',    NEW.folio,
        'paciente', NEW.paciente_nombre,
        'total',    NEW.total_con_descuento,
        'sucursal', NEW.sucursal,
        'a_cuenta', NEW.a_cuenta,
        'resta',    NEW.resta
      )
    );
    return NEW;
  elsif (TG_OP = 'DELETE') then
    insert into public.audit_logs(action, entity, entity_id, user_email, detail)
    values (
      'delete_sale', 'sale', OLD.folio, audit_actor_email(),
      jsonb_build_object(
        'folio',    OLD.folio,
        'paciente', OLD.paciente_nombre,
        'total',    OLD.total_con_descuento,
        'sucursal', OLD.sucursal
      )
    );
    return OLD;
  end if;
  return null;
end;
$$;

create or replace function "public"."audit_log_sale_date"() returns "trigger"
    language "plpgsql" security definer
    set "search_path" to 'public', 'auth'
    as $$
begin
  insert into public.audit_logs(action, entity, entity_id, user_email, detail)
  values (
    'change_date', 'sale', NEW.folio, audit_actor_email(),
    jsonb_build_object('old_value', OLD.fecha_legado, 'new_value', NEW.fecha_legado)
  );
  return NEW;
end;
$$;
