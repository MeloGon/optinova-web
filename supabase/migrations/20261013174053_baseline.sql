--
-- PostgreSQL database dump
--

\restrict AmQa5JZmzgQRNUiqMyInYYI5PmcQsuhugzY0XxPraQaqYsSs07O47j5Ze2GJ1Aw

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: audit_actor_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."audit_actor_email"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select coalesce(nullif(auth.jwt() ->> 'email', ''), 'system');
$$;


--
-- Name: audit_log_payment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."audit_log_payment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
begin
  insert into public.audit_logs(action, entity, entity_id, user_email, detail)
  values (
    'register_payment', 'payment', NEW.id_remision, audit_actor_email(),
    jsonb_build_object(
      'monto',       NEW.monto,
      'metodo_pago', NEW.metodo_pago,
      'tipo_pago',   NEW.tipo_pago,
      'fecha_pago',  NEW.fecha_pago
    )
  );
  return NEW;
end;
$$;


--
-- Name: audit_log_sale(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."audit_log_sale"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
begin
  if (TG_OP = 'INSERT') then
    insert into public.audit_logs(action, entity, entity_id, user_email, detail)
    values (
      'create_sale', 'sale', NEW."FOLIO REMISION", audit_actor_email(),
      jsonb_build_object(
        'folio',    NEW."FOLIO REMISION",
        'paciente', NEW."PACIENTE",
        'total',    NEW."TOTAL CON DESCUENTO",
        'sucursal', NEW."SUCURSAL",
        'a_cuenta', NEW."A CUENTA",
        'resta',    NEW."RESTA"
      )
    );
    return NEW;
  elsif (TG_OP = 'DELETE') then
    insert into public.audit_logs(action, entity, entity_id, user_email, detail)
    values (
      'delete_sale', 'sale', OLD."FOLIO REMISION", audit_actor_email(),
      jsonb_build_object(
        'folio',    OLD."FOLIO REMISION",
        'paciente', OLD."PACIENTE",
        'total',    OLD."TOTAL CON DESCUENTO",
        'sucursal', OLD."SUCURSAL"
      )
    );
    return OLD;
  end if;
  return null;
end;
$$;


--
-- Name: audit_log_sale_date(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."audit_log_sale_date"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
begin
  insert into public.audit_logs(action, entity, entity_id, user_email, detail)
  values (
    'change_date', 'sale', NEW."FOLIO REMISION", audit_actor_email(),
    jsonb_build_object('old_value', OLD."FECHA", 'new_value', NEW."FECHA")
  );
  return NEW;
end;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.perfiles (id, rol) values (new.id, 'vendedor');
  return new;
end;
$$;


--
-- Name: jwt_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."jwt_role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), 'vendedor');
$$;


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: app_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."app_config" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: armazones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."armazones" (
    "MARCA" "text",
    "MODELO" "text",
    "COLOR" "text",
    "DESCRIPCION" "text",
    "PRECIO" numeric(10,2),
    "NOMBRE DE LA OPTICA" "text",
    "ID ARMAZON" bigint NOT NULL,
    "FECHA DE REGISTRO" "text",
    "CODIGO DE BARRAS" "text",
    "EXISTENCIAS" smallint,
    "Expr1010" "text",
    "PROVEEDOR" "text",
    "CONSIGNACION" "text",
    "CREADO EL" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "armazones"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."armazones" IS 'tabla inventario de armazones';


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action" "text" NOT NULL,
    "entity" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "user_email" "text" NOT NULL,
    "detail" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: categorias_egresos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."categorias_egresos" (
    "id" integer NOT NULL,
    "nombre" "text" NOT NULL,
    "color" "text" DEFAULT '#6366F1'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: categorias_egresos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."categorias_egresos_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categorias_egresos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."categorias_egresos_id_seq" OWNED BY "public"."categorias_egresos"."id";


--
-- Name: egresos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."egresos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fecha" "date" NOT NULL,
    "categoria_id" integer,
    "descripcion" "text" NOT NULL,
    "monto" numeric(10,2) NOT NULL,
    "metodo_pago" "text" NOT NULL,
    "comprobante" "text",
    "sucursal" "text",
    "registrado_por" "text",
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: pacientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."pacientes" (
    "SUCURSAL" "text",
    "ID PACIENTE" bigint NOT NULL,
    "FECHA DE REGISTRO" "text",
    "NOMBRE COMPLETO" "text",
    "FECHA DE NACIMIENTO" "text",
    "DOMICILIO" "text",
    "COLONIA O LOCALIDAD" "text",
    "DEL O MPIO" "text",
    "ENTIDAD FEDERATIVA" "text",
    "TELEFONO 1" "text",
    "EMAIL" "text",
    "TELEFONO CEL" "text",
    "OCUPACION" "text",
    "EMPRESA" "text",
    "NUMERO DE EMPLEADO" "text",
    "IDENTIFICACION" "text",
    "OBSERVACIONES" "text",
    "GENERO" "text",
    "PERSONALIZADO 1" "text",
    "PERSONALIZADO 2" "text",
    "PERSONALIZADO 3" "text",
    "PERSONALIZADO 4" "text",
    "PERSONALIZADO 5" "text",
    "USA DISPOSITIVOS" "text",
    "HIPERSENSIBILIDAD A LA LUZ" "text",
    "fecha_registro_actualizada" "date"
);


--
-- Name: TABLE "pacientes"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."pacientes" IS 'tabla de pacientes';


--
-- Name: pagos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."pagos" (
    "id" bigint NOT NULL,
    "id_remision" "text" NOT NULL,
    "monto" numeric NOT NULL,
    "fecha_pago" "date" DEFAULT CURRENT_DATE NOT NULL,
    "metodo_pago" "text",
    "registrado_por" "uuid",
    "notas" "text",
    "creado_el" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tipo_pago" "text" DEFAULT 'abono_saldo'::"text",
    CONSTRAINT "pagos_metodo_pago_check" CHECK (("metodo_pago" = ANY (ARRAY['efectivo'::"text", 'tarjeta'::"text", 'transferencia'::"text", 'yape'::"text", 'nomina'::"text", 'otro'::"text"]))),
    CONSTRAINT "pagos_monto_check" CHECK (("monto" > (0)::numeric))
);


--
-- Name: pagos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."pagos" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."pagos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: perfiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."perfiles" (
    "id" "uuid" NOT NULL,
    "nombre" "text",
    "sucursal" "text",
    "rol" "text" DEFAULT 'vendedor'::"text",
    "creado_en" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "perfiles_rol_check" CHECK (("rol" = ANY (ARRAY['admin'::"text", 'vendedor'::"text", 'supervisor'::"text", 'megadmin'::"text"])))
);


--
-- Name: resinas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."resinas" (
    "id_oftalmico" bigint NOT NULL,
    "descripcion" "text",
    "diseño" "text",
    "linea" "text",
    "material" "text",
    "tecnologia" "text",
    "texto" "text",
    "cantidad" smallint,
    "precio" numeric,
    "precio_interno" numeric,
    "CREADO EL" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: TABLE "resinas"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."resinas" IS 'tabla de resinas';


--
-- Name: COLUMN "resinas"."precio_interno"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."resinas"."precio_interno" IS 'precio de venta solo interno para vendedores';


--
-- Name: resinas_id_oftalmico_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."resinas" ALTER COLUMN "id_oftalmico" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."resinas_id_oftalmico_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: revisiones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."revisiones" (
    "ID REFRACCION" bigint NOT NULL,
    "PACIENTE" "text",
    "FECHA" "text",
    "MOTIVO DE CONSULTA" "text",
    "HISTORIA CLINICA" "text",
    "OD ESF" "text",
    "OD CIL" "text",
    "OD EJE" "text",
    "OD AV" "text",
    "OI ESF" "text",
    "OI CIL" "text",
    "OI EJE" "text",
    "OI AV" "text",
    "ADD" "text",
    "OBSERVACIONES" "text",
    "DIP" "text",
    "SUCURSAL" "text",
    "OD CB LC" "text",
    "OD DIAM LC" "text",
    "OI CB LC" "text",
    "OI DIAM LC" "text",
    "TIPO DE GRADUACION" "text",
    "AV SIN RX OD LEJOS" "text",
    "AV SIN RX OI LEJOS" "text",
    "CV OD LEJOS" "text",
    "CV OI LEJOS" "text",
    "AV SIN RX OD CERCA" "text",
    "AV SIN RX OI CERCA" "text",
    "AV CON RX OD CERCA" "text",
    "AV CON RX OI CERCA" "text",
    "DIAGNOSTICO OPTOMETRICO" "text",
    "fecha_revision_actualizada" "date"
);


--
-- Name: TABLE "revisiones"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."revisiones" IS 'tabla de revisiones';


--
-- Name: vendedores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."vendedores" (
    "id" bigint NOT NULL,
    "creado_el" timestamp with time zone DEFAULT "now"() NOT NULL,
    "NOMBRE" "text"
);


--
-- Name: TABLE "vendedores"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."vendedores" IS 'tabla de vendedores';


--
-- Name: vendedores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE "public"."vendedores" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."vendedores_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ventas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ventas" (
    "ID" bigint NOT NULL,
    "ID REMISION" "text",
    "FOLIO DE VENTA" "text",
    "FECHA DE VENTA" "text",
    "PACIENTE" "text",
    "ID OFTALMICO" bigint,
    "DESCRIPCION" "text",
    "DISEÑO" "text",
    "LINEA" "text",
    "MATERIAL" "text",
    "TECNOLOGIA" "text",
    "SERIE" "text",
    "TEXTO" "text",
    "CANTIDAD" "text",
    "PRECIO" numeric(10,2),
    "ID MONTURA" bigint,
    "MONTURA" "text",
    "MONTURA MARCA" "text",
    "MONTURA MODELO" "text",
    "MONTURA COLOR" "text",
    "MONTURA CANTIDAD" "text",
    "MONTURA PRECIO" numeric(10,2),
    "MONTURA TEXTO" "text",
    "fecha_ventas_actualizada" "date"
);


--
-- Name: TABLE "ventas"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."ventas" IS 'tabla de ventas';


--
-- Name: ventas cortas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."ventas cortas" (
    "SUCURSAL" "text",
    "ID REMISION" "text" NOT NULL,
    "FECHA" "text",
    "FOLIO REMISION" "text",
    "ID PACIENTE" "text",
    "PACIENTE" "text",
    "AUTOR NOMBRE" "text",
    "AUTOR APELLIDOS" "text",
    "TOTAL" numeric(10,2),
    "DESCUENTO" numeric(10,2),
    "TOTAL CON DESCUENTO" numeric(10,2),
    "A CUENTA" numeric(10,2),
    "RESTA" numeric(10,2),
    "MOTIVO DEL DESCUENTO" "text",
    "NUMERO DE PARCIALIDADES" "text",
    "MONTO DEL DESCUENTO VIA NOMINA" "text",
    "fecha_actualizada" "date",
    "fecha_venta_iso" "date"
);


--
-- Name: TABLE "ventas cortas"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE "public"."ventas cortas" IS 'tabla de ventas sin detalle';


--
-- Name: categorias_egresos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."categorias_egresos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."categorias_egresos_id_seq"'::"regclass");


--
-- Name: app_config app_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."app_config"
    ADD CONSTRAINT "app_config_pkey" PRIMARY KEY ("key");


--
-- Name: armazones armazones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."armazones"
    ADD CONSTRAINT "armazones_pkey" PRIMARY KEY ("ID ARMAZON");


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");


--
-- Name: categorias_egresos categorias_egresos_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."categorias_egresos"
    ADD CONSTRAINT "categorias_egresos_nombre_key" UNIQUE ("nombre");


--
-- Name: categorias_egresos categorias_egresos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."categorias_egresos"
    ADD CONSTRAINT "categorias_egresos_pkey" PRIMARY KEY ("id");


--
-- Name: egresos egresos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."egresos"
    ADD CONSTRAINT "egresos_pkey" PRIMARY KEY ("id");


--
-- Name: pacientes pacientes_ID PACIENTE_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pacientes"
    ADD CONSTRAINT "pacientes_ID PACIENTE_key" UNIQUE ("ID PACIENTE");


--
-- Name: pacientes pacientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pacientes"
    ADD CONSTRAINT "pacientes_pkey" PRIMARY KEY ("ID PACIENTE");


--
-- Name: pagos pagos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pagos"
    ADD CONSTRAINT "pagos_pkey" PRIMARY KEY ("id");


--
-- Name: perfiles perfiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_pkey" PRIMARY KEY ("id");


--
-- Name: resinas resinas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."resinas"
    ADD CONSTRAINT "resinas_pkey" PRIMARY KEY ("id_oftalmico");


--
-- Name: revisiones revisiones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."revisiones"
    ADD CONSTRAINT "revisiones_pkey" PRIMARY KEY ("ID REFRACCION");


--
-- Name: vendedores vendedores_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."vendedores"
    ADD CONSTRAINT "vendedores_id_key" UNIQUE ("id");


--
-- Name: vendedores vendedores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."vendedores"
    ADD CONSTRAINT "vendedores_pkey" PRIMARY KEY ("id");


--
-- Name: ventas cortas ventas cortas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ventas cortas"
    ADD CONSTRAINT "ventas cortas_pkey" PRIMARY KEY ("ID REMISION");


--
-- Name: ventas ventas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."ventas"
    ADD CONSTRAINT "ventas_pkey" PRIMARY KEY ("ID");


--
-- Name: audit_logs_action_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_logs_action_created_at_idx" ON "public"."audit_logs" USING "btree" ("action", "created_at" DESC);


--
-- Name: audit_logs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_logs_created_at_idx" ON "public"."audit_logs" USING "btree" ("created_at" DESC);


--
-- Name: audit_logs_user_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_logs_user_created_at_idx" ON "public"."audit_logs" USING "btree" ("user_email", "created_at" DESC);


--
-- Name: idx_pagos_id_remision; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_pagos_id_remision" ON "public"."pagos" USING "btree" ("id_remision");


--
-- Name: pacientes_fecha_registro_actualizada_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "pacientes_fecha_registro_actualizada_idx" ON "public"."pacientes" USING "btree" ("fecha_registro_actualizada");


--
-- Name: pagos trg_audit_payment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_audit_payment" AFTER INSERT ON "public"."pagos" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_payment"();


--
-- Name: ventas cortas trg_audit_sale; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_audit_sale" AFTER INSERT OR DELETE ON "public"."ventas cortas" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_sale"();


--
-- Name: ventas cortas trg_audit_sale_date; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trg_audit_sale_date" AFTER UPDATE OF "FECHA" ON "public"."ventas cortas" FOR EACH ROW WHEN (("old"."FECHA" IS DISTINCT FROM "new"."FECHA")) EXECUTE FUNCTION "public"."audit_log_sale_date"();


--
-- Name: egresos egresos_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."egresos"
    ADD CONSTRAINT "egresos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias_egresos"("id");


--
-- Name: pagos pagos_id_remision_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pagos"
    ADD CONSTRAINT "pagos_id_remision_fkey" FOREIGN KEY ("id_remision") REFERENCES "public"."ventas cortas"("ID REMISION") ON DELETE RESTRICT;


--
-- Name: pagos pagos_registrado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."pagos"
    ADD CONSTRAINT "pagos_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "public"."perfiles"("id");


--
-- Name: perfiles perfiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: pagos Actualización autenticada; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Actualización autenticada" ON "public"."pagos" FOR UPDATE TO "authenticated" USING (true);


--
-- Name: pagos Eliminación autenticada; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Eliminación autenticada" ON "public"."pagos" FOR DELETE TO "authenticated" USING (true);


--
-- Name: pagos Inserción autenticada; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Inserción autenticada" ON "public"."pagos" FOR INSERT TO "authenticated" WITH CHECK (true);


--
-- Name: pagos Lectura autenticada; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lectura autenticada" ON "public"."pagos" FOR SELECT TO "authenticated" USING (true);


--
-- Name: armazones Policy with security definer functions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Policy with security definer functions" ON "public"."armazones" USING (true);


--
-- Name: categorias_egresos Policy with security definer functions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Policy with security definer functions" ON "public"."categorias_egresos" USING (true);


--
-- Name: egresos Policy with security definer functions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Policy with security definer functions" ON "public"."egresos" USING (true);


--
-- Name: pacientes Policy with security definer functions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Policy with security definer functions" ON "public"."pacientes" USING (true);


--
-- Name: resinas Policy with security definer functions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Policy with security definer functions" ON "public"."resinas" USING (true);


--
-- Name: revisiones Policy with security definer functions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Policy with security definer functions" ON "public"."revisiones" USING (true);


--
-- Name: vendedores Policy with security definer functions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Policy with security definer functions" ON "public"."vendedores" USING (true);


--
-- Name: ventas Policy with security definer functions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Policy with security definer functions" ON "public"."ventas" USING (true);


--
-- Name: ventas cortas Policy with security definer functions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Policy with security definer functions" ON "public"."ventas cortas" USING (true);


--
-- Name: perfiles admin all perfiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin all perfiles" ON "public"."perfiles" USING (("public"."jwt_role"() = 'admin'::"text")) WITH CHECK (("public"."jwt_role"() = 'admin'::"text"));


--
-- Name: app_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."app_config" ENABLE ROW LEVEL SECURITY;

--
-- Name: armazones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."armazones" ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs authenticated can insert audit_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated can insert audit_logs" ON "public"."audit_logs" FOR INSERT TO "authenticated" WITH CHECK (true);


--
-- Name: app_config authenticated can read app_config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated can read app_config" ON "public"."app_config" FOR SELECT TO "authenticated" USING (true);


--
-- Name: audit_logs authenticated can read audit_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated can read audit_logs" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING (true);


--
-- Name: app_config authenticated can update app_config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated can update app_config" ON "public"."app_config" FOR UPDATE TO "authenticated" USING (true);


--
-- Name: categorias_egresos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."categorias_egresos" ENABLE ROW LEVEL SECURITY;

--
-- Name: egresos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."egresos" ENABLE ROW LEVEL SECURITY;

--
-- Name: perfiles own profile read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own profile read" ON "public"."perfiles" FOR SELECT USING (("id" = "auth"."uid"()));


--
-- Name: perfiles own profile update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own profile update" ON "public"."perfiles" FOR UPDATE USING (("id" = "auth"."uid"()));


--
-- Name: pacientes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."pacientes" ENABLE ROW LEVEL SECURITY;

--
-- Name: pagos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."pagos" ENABLE ROW LEVEL SECURITY;

--
-- Name: perfiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."perfiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: resinas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."resinas" ENABLE ROW LEVEL SECURITY;

--
-- Name: revisiones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."revisiones" ENABLE ROW LEVEL SECURITY;

--
-- Name: vendedores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."vendedores" ENABLE ROW LEVEL SECURITY;

--
-- Name: ventas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ventas" ENABLE ROW LEVEL SECURITY;

--
-- Name: ventas cortas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ventas cortas" ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA "public"; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


--
-- Name: FUNCTION "audit_actor_email"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."audit_actor_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_actor_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_actor_email"() TO "service_role";


--
-- Name: FUNCTION "audit_log_payment"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."audit_log_payment"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_log_payment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_log_payment"() TO "service_role";


--
-- Name: FUNCTION "audit_log_sale"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."audit_log_sale"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_log_sale"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_log_sale"() TO "service_role";


--
-- Name: FUNCTION "audit_log_sale_date"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."audit_log_sale_date"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_log_sale_date"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_log_sale_date"() TO "service_role";


--
-- Name: FUNCTION "handle_new_user"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";


--
-- Name: FUNCTION "jwt_role"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."jwt_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."jwt_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."jwt_role"() TO "service_role";


--
-- Name: TABLE "app_config"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."app_config" TO "anon";
GRANT ALL ON TABLE "public"."app_config" TO "authenticated";
GRANT ALL ON TABLE "public"."app_config" TO "service_role";


--
-- Name: TABLE "armazones"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."armazones" TO "anon";
GRANT ALL ON TABLE "public"."armazones" TO "authenticated";
GRANT ALL ON TABLE "public"."armazones" TO "service_role";


--
-- Name: TABLE "audit_logs"; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."audit_logs" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,MAINTAIN ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";


--
-- Name: TABLE "categorias_egresos"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."categorias_egresos" TO "anon";
GRANT ALL ON TABLE "public"."categorias_egresos" TO "authenticated";
GRANT ALL ON TABLE "public"."categorias_egresos" TO "service_role";


--
-- Name: SEQUENCE "categorias_egresos_id_seq"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE "public"."categorias_egresos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."categorias_egresos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."categorias_egresos_id_seq" TO "service_role";


--
-- Name: TABLE "egresos"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."egresos" TO "anon";
GRANT ALL ON TABLE "public"."egresos" TO "authenticated";
GRANT ALL ON TABLE "public"."egresos" TO "service_role";


--
-- Name: TABLE "pacientes"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."pacientes" TO "anon";
GRANT ALL ON TABLE "public"."pacientes" TO "authenticated";
GRANT ALL ON TABLE "public"."pacientes" TO "service_role";


--
-- Name: TABLE "pagos"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."pagos" TO "anon";
GRANT ALL ON TABLE "public"."pagos" TO "authenticated";
GRANT ALL ON TABLE "public"."pagos" TO "service_role";


--
-- Name: SEQUENCE "pagos_id_seq"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE "public"."pagos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pagos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pagos_id_seq" TO "service_role";


--
-- Name: TABLE "perfiles"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."perfiles" TO "anon";
GRANT ALL ON TABLE "public"."perfiles" TO "authenticated";
GRANT ALL ON TABLE "public"."perfiles" TO "service_role";


--
-- Name: TABLE "resinas"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."resinas" TO "anon";
GRANT ALL ON TABLE "public"."resinas" TO "authenticated";
GRANT ALL ON TABLE "public"."resinas" TO "service_role";


--
-- Name: SEQUENCE "resinas_id_oftalmico_seq"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE "public"."resinas_id_oftalmico_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."resinas_id_oftalmico_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."resinas_id_oftalmico_seq" TO "service_role";


--
-- Name: TABLE "revisiones"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."revisiones" TO "anon";
GRANT ALL ON TABLE "public"."revisiones" TO "authenticated";
GRANT ALL ON TABLE "public"."revisiones" TO "service_role";


--
-- Name: TABLE "vendedores"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."vendedores" TO "anon";
GRANT ALL ON TABLE "public"."vendedores" TO "authenticated";
GRANT ALL ON TABLE "public"."vendedores" TO "service_role";


--
-- Name: SEQUENCE "vendedores_id_seq"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE "public"."vendedores_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."vendedores_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."vendedores_id_seq" TO "service_role";


--
-- Name: TABLE "ventas"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."ventas" TO "anon";
GRANT ALL ON TABLE "public"."ventas" TO "authenticated";
GRANT ALL ON TABLE "public"."ventas" TO "service_role";


--
-- Name: TABLE "ventas cortas"; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE "public"."ventas cortas" TO "anon";
GRANT ALL ON TABLE "public"."ventas cortas" TO "authenticated";
GRANT ALL ON TABLE "public"."ventas cortas" TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--

\unrestrict AmQa5JZmzgQRNUiqMyInYYI5PmcQsuhugzY0XxPraQaqYsSs07O47j5Ze2GJ1Aw

