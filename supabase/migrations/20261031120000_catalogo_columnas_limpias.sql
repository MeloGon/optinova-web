-- Cambio #9: columnas limpias de armazones, resinas y vendedores (snake_case),
-- necesarias para E2.6 Vender (catálogo de productos). Ver docs/db-changes.md.

-- armazones --------------------------------------------------------------------
alter table "public"."armazones" rename column "ID ARMAZON" to "id";
alter table "public"."armazones" rename column "MARCA" to "marca";
alter table "public"."armazones" rename column "MODELO" to "modelo";
alter table "public"."armazones" rename column "COLOR" to "color";
alter table "public"."armazones" rename column "DESCRIPCION" to "descripcion";
alter table "public"."armazones" rename column "PRECIO" to "precio";
alter table "public"."armazones" rename column "NOMBRE DE LA OPTICA" to "sucursal";
alter table "public"."armazones" rename column "CODIGO DE BARRAS" to "codigo_barras";
alter table "public"."armazones" rename column "EXISTENCIAS" to "existencias";
alter table "public"."armazones" rename column "CREADO EL" to "creado_el";
-- Texto en formato variable (ej. "09-sept-24"); ninguna pantalla la lee (ni el
-- catálogo de Vender ni Flutter). Se conserva como respaldo en vez de borrarla.
alter table "public"."armazones" rename column "FECHA DE REGISTRO" to "fecha_registro_legado";
-- Basura heredada de un import de Access: en las 2,952 filas de PROD siempre
-- "FALSO"/"0"/vacío/null (comprobado antes de aplicar). Ninguna pantalla las usa.
alter table "public"."armazones" drop column "Expr1010";
alter table "public"."armazones" drop column "PROVEEDOR";
alter table "public"."armazones" drop column "CONSIGNACION";

-- resinas ----------------------------------------------------------------------
alter table "public"."resinas" rename column "CREADO EL" to "creado_el";
alter table "public"."resinas" rename column "diseño" to "diseno";

-- vendedores --------------------------------------------------------------------
alter table "public"."vendedores" rename column "NOMBRE" to "nombre";
