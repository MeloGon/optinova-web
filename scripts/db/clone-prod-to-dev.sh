#!/usr/bin/env bash
# Clona la ESTRUCTURA de PROD (oftal-test-web) hacia DEV (optinova-db). Version bash de
# clone-prod-to-dev.ps1 (misma logica) para Mac y Linux.
#
#  - Por defecto: solo esquema (tablas, RLS, funciones, grants, trigger de auth).
#    Los datos de DEV salen de supabase/seed.sql (datos falsos).
#  - --with-data: copia ademas usuarios y datos reales (ensayo y corte final, Fase 5).
#  - PROD solo se LEE (pg_dump). Nunca se escribe.
#  - DEV se VACIA primero (esquema public + auth.users/identities) y se llena todo en UNA
#    transaccion: si algo falla, DEV queda como estaba.
#  - Pide escribir SI antes de vaciar DEV (--yes lo omite; solo para automatizar).
#  - NO genera baseline en supabase/migrations/: las migraciones #2 a #25 se reaplican encima.
#  - Las URLs (con password) se leen de .env.db (ignorado por git) o, si no existe, de las
#    variables de entorno; nunca se guardan en otro lado.
#
# .env.db (raiz del repo):
#   PROD_DB_URL=postgresql://postgres.<ref-prod>:<password>@<host>:5432/postgres
#   DEV_DB_URL=postgresql://postgres.<ref-dev>:<password>@<host>:5432/postgres
#
# Uso (desde la raiz del repo):
#   ./scripts/db/clone-prod-to-dev.sh --with-data
set -euo pipefail

WITH_DATA=0
KEEP_DUMP=0
YES=0
for arg in "$@"; do
  case "$arg" in
    --with-data) WITH_DATA=1 ;;
    --keep-dump) KEEP_DUMP=1 ;;
    --yes) YES=1 ;;
    *) echo "Opcion desconocida: $arg" >&2; exit 2 ;;
  esac
done

PROD_REF='gutgxjgfjbodznzjiqtm'
DEV_REF='dqofpmpyxumkzlsqcjri'

# --- 1. Validaciones de seguridad -------------------------------------------
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.db"
if [[ -f "$ENV_FILE" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ ^[[:space:]]*(PROD_DB_URL|DEV_DB_URL)[[:space:]]*=[[:space:]]*(.+)[[:space:]]*$ ]]; then
      value="${BASH_REMATCH[2]}"
      value="${value%\"}"; value="${value#\"}"; value="${value%\'}"; value="${value#\'}"
      export "${BASH_REMATCH[1]}=$value"
    fi
  done < "$ENV_FILE"
fi
PROD="${PROD_DB_URL:-}"
DEV="${DEV_DB_URL:-}"
[[ -n "$PROD" && -n "$DEV" ]] || { echo 'Faltan PROD_DB_URL y/o DEV_DB_URL.' >&2; exit 1; }
[[ "$PROD" == *"$PROD_REF"* ]] || { echo "PROD_DB_URL no apunta a PROD ($PROD_REF)." >&2; exit 1; }
[[ "$DEV" == *"$DEV_REF"* ]] || { echo "DEV_DB_URL no apunta a DEV ($DEV_REF)." >&2; exit 1; }
[[ "$DEV" != *"$PROD_REF"* ]] || { echo 'DEV_DB_URL contiene el ref de PROD. Abortando.' >&2; exit 1; }

# --- 2. Localizar pg_dump / psql --------------------------------------------
# libpq de Homebrew no se enlaza al PATH por defecto.
for d in /opt/homebrew/opt/libpq/bin /usr/local/opt/libpq/bin; do
  [[ -d "$d" ]] && PATH="$d:$PATH"
done
command -v pg_dump >/dev/null || { echo 'No hay pg_dump. En Mac: brew install libpq' >&2; exit 1; }
command -v psql >/dev/null || { echo 'No hay psql. En Mac: brew install libpq' >&2; exit 1; }

OUT="$REPO_ROOT/.db-dump"
mkdir -p "$OUT"
cleanup() { [[ "$KEEP_DUMP" -eq 1 ]] || rm -rf "$OUT"; }
trap cleanup EXIT

# --- 3. Volcar PROD (solo lectura) ------------------------------------------
echo '[1/5] Volcando esquema public de PROD...'
SCHEMA_FILE="$OUT/schema.sql"
pg_dump --dbname "$PROD" --schema-only --schema=public \
  --no-owner --quote-all-identifiers --file "$SCHEMA_FILE"

# El esquema public y sus privilegios por defecto ya existen en un proyecto Supabase nuevo;
# recrearlos falla por permisos.
grep -v -e '^CREATE SCHEMA "public";' -e '^COMMENT ON SCHEMA "public"' \
  -e '^ALTER DEFAULT PRIVILEGES ' "$SCHEMA_FILE" > "$SCHEMA_FILE.tmp" || true
mv "$SCHEMA_FILE.tmp" "$SCHEMA_FILE"

AUTH_FILE="$OUT/auth_data.sql"
DATA_FILE="$OUT/public_data.sql"
if [[ "$WITH_DATA" -eq 1 ]]; then
  echo '[2/5] Volcando usuarios (auth.users, auth.identities)...'
  pg_dump --dbname "$PROD" --data-only --table=auth.users --table=auth.identities \
    --quote-all-identifiers --file "$AUTH_FILE"

  echo '[3/5] Volcando datos public...'
  pg_dump --dbname "$PROD" --data-only --schema=public \
    --quote-all-identifiers --file "$DATA_FILE"
else
  echo '[2-3/5] Sin datos (modo solo esquema).'
  : > "$AUTH_FILE"
  : > "$DATA_FILE"
fi

# Trigger en auth.users: vive en el esquema auth, no entra en el dump de public.
TRIGGER_FILE="$OUT/auth_trigger.sql"
cat > "$TRIGGER_FILE" <<'SQL'
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
SQL

# --- 4. Vaciar y restaurar DEV (una sola transaccion) ------------------------
if [[ "$YES" -ne 1 ]]; then
  echo
  echo "Se va a VACIAR DEV ($DEV_REF): esquema public y auth.users."
  echo 'Se pierden el seed y cualquier dato de prueba de DEV.'
  read -r -p 'Escribe SI para continuar: ' answer
  [[ "$answer" == 'SI' ]] || { echo 'Cancelado por el usuario.' >&2; exit 1; }
fi

# Borra tablas, vistas, secuencias sueltas, funciones y tipos de public (las de extensiones se
# respetan) y vacia auth.users con sus dependientes. Se borran los objetos y no el esquema
# porque recrear `public` falla por permisos.
WIPE_FILE="$OUT/wipe.sql"
cat > "$WIPE_FILE" <<'SQL'
DO $wipe$
DECLARE r record;
BEGIN
  FOR r IN SELECT format('%I.%I', schemaname, viewname) AS n FROM pg_views WHERE schemaname = 'public' LOOP
    EXECUTE 'DROP VIEW IF EXISTS ' || r.n || ' CASCADE';
  END LOOP;
  FOR r IN SELECT format('%I.%I', schemaname, tablename) AS n FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'DROP TABLE IF EXISTS ' || r.n || ' CASCADE';
  END LOOP;
  FOR r IN SELECT format('%I.%I', n.nspname, c.relname) AS n
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind = 'S' LOOP
    EXECUTE 'DROP SEQUENCE IF EXISTS ' || r.n || ' CASCADE';
  END LOOP;
  FOR r IN SELECT p.oid::regprocedure AS n
           FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
           WHERE ns.nspname = 'public' AND p.prokind IN ('f', 'p')
             AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e') LOOP
    EXECUTE 'DROP ROUTINE IF EXISTS ' || r.n || ' CASCADE';
  END LOOP;
  FOR r IN SELECT format('%I.%I', ns.nspname, t.typname) AS n
           FROM pg_type t JOIN pg_namespace ns ON ns.oid = t.typnamespace
           WHERE ns.nspname = 'public' AND t.typtype IN ('e', 'd')
             AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = t.oid AND d.deptype = 'e') LOOP
    EXECUTE 'DROP TYPE IF EXISTS ' || r.n || ' CASCADE';
  END LOOP;
END
$wipe$;
TRUNCATE auth.users CASCADE;
SQL

# session_replication_role = replica desactiva triggers y FKs durante la carga (asi no se
# disparan los triggers de auditoria ni handle_new_user).
echo '[4/5] Vaciando y restaurando DEV (todo o nada)...'
psql --dbname "$DEV" --single-transaction -v ON_ERROR_STOP=1 --quiet \
  --file "$WIPE_FILE" \
  --file "$SCHEMA_FILE" \
  --command 'SET session_replication_role = replica' \
  --file "$AUTH_FILE" \
  --file "$DATA_FILE" \
  --command 'SET session_replication_role = origin' \
  --file "$TRIGGER_FILE"

# --- 5. Verificar --------------------------------------------------------------
echo '[5/5] Verificando...'
TABLES_SQL="SELECT count(*) FROM pg_tables WHERE schemaname = 'public'"
PROD_TABLES="$(psql --dbname "$PROD" -At -c "$TABLES_SQL")"
DEV_TABLES="$(psql --dbname "$DEV" -At -c "$TABLES_SQL")"
echo "  Tablas public: PROD=$PROD_TABLES DEV=$DEV_TABLES"
if [[ "$PROD_TABLES" != "$DEV_TABLES" ]]; then
  echo 'DIFERENCIA EN TABLAS'
elif [[ "$WITH_DATA" -ne 1 ]]; then
  echo 'OK: estructura copiada.'
fi

if [[ "$WITH_DATA" -eq 1 ]]; then
  COUNT_FILE="$OUT/count.sql"
  cat > "$COUNT_FILE" <<'SQL'
SELECT format('SELECT %L, count(*) FROM %I.%I', schemaname || '.' || tablename, schemaname, tablename)
FROM pg_tables
WHERE schemaname = 'public' OR (schemaname = 'auth' AND tablename IN ('users', 'identities'))
ORDER BY 1
\gexec
SQL
  psql --dbname "$PROD" -At -F ' = ' --file "$COUNT_FILE" > "$OUT/counts_prod.txt"
  psql --dbname "$DEV" -At -F ' = ' --file "$COUNT_FILE" > "$OUT/counts_dev.txt"
  echo
  sed 's/^/  /' "$OUT/counts_prod.txt"
  echo
  if diff "$OUT/counts_prod.txt" "$OUT/counts_dev.txt" > "$OUT/counts.diff"; then
    echo 'OK: PROD y DEV tienen los mismos conteos.'
  else
    echo 'DIFERENCIAS ENCONTRADAS (< PROD, > DEV):'
    cat "$OUT/counts.diff"
    exit 1
  fi
fi

[[ "$KEEP_DUMP" -eq 1 ]] || echo 'Volcados borrados (.db-dump/).'
