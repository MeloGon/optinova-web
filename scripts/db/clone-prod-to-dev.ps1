<#
  Clona la ESTRUCTURA de PROD (oftal-test-web) hacia DEV (optinova-db).

  - Por defecto: solo esquema (tablas, RLS, funciones, grants, trigger de auth).
    Los datos de DEV salen de supabase/seed.sql (datos falsos).
  - -WithData: copia ademas usuarios y datos reales (ensayo y corte final, Fase 5).
  - PROD solo se LEE (pg_dump). Nunca se escribe.
  - DEV se VACIA primero (esquema public + auth.users/identities) y se llena
    todo en UNA transaccion: si algo falla, DEV queda como estaba.
  - Pide escribir SI antes de vaciar DEV (-Yes lo omite; solo para automatizar).
  - NO genera baseline en supabase/migrations/: el esquema clonado es el punto
    de partida del ensayo y las migraciones #2 a #25 se reaplican encima.
  - Las URLs (con password) se leen de .env.db (ignorado por git) o, si no
    existe, de las variables de entorno; nunca se guardan en otro lado.

  .env.db (raiz del repo):
    PROD_DB_URL=postgresql://postgres.<ref-prod>:<password>@<host>:5432/postgres
    DEV_DB_URL=postgresql://postgres.<ref-dev>:<password>@<host>:5432/postgres

  Uso (PowerShell, desde la raiz del repo):
    .\scripts\db\clone-prod-to-dev.ps1 -WithData
#>
param(
  [switch]$WithData,  # copia tambien auth.users + datos public reales
  [switch]$KeepDump,  # conserva .db-dump/ (contiene datos reales; esta en .gitignore)
  [switch]$Yes        # omite la confirmacion antes de vaciar DEV
)

$ErrorActionPreference = 'Stop'

$ProdRef = 'gutgxjgfjbodznzjiqtm'
$DevRef  = 'dqofpmpyxumkzlsqcjri'

# --- 1. Validaciones de seguridad -------------------------------------------
$RepoRoot = (Resolve-Path (Join-Path (Join-Path $PSScriptRoot '..') '..')).Path
$EnvFile = Join-Path $RepoRoot '.env.db'
if (Test-Path $EnvFile) {
  foreach ($line in Get-Content $EnvFile) {
    if ($line -match '^\s*(PROD_DB_URL|DEV_DB_URL)\s*=\s*(.+?)\s*$') {
      Set-Item -Path "Env:$($Matches[1])" -Value $Matches[2].Trim('"', "'")
    }
  }
}
$Prod = $env:PROD_DB_URL
$Dev  = $env:DEV_DB_URL
if (-not $Prod -or -not $Dev) { throw 'Faltan PROD_DB_URL y/o DEV_DB_URL.' }
if ($Prod -notmatch $ProdRef) { throw "PROD_DB_URL no apunta a PROD ($ProdRef)." }
if ($Dev  -notmatch $DevRef)  { throw "DEV_DB_URL no apunta a DEV ($DevRef)." }
if ($Dev  -match   $ProdRef)  { throw 'DEV_DB_URL contiene el ref de PROD. Abortando.' }

# --- 2. Localizar pg_dump / psql --------------------------------------------
$PgBin = 'C:\Program Files\PostgreSQL\17\bin'
$PgDump = if (Get-Command pg_dump -ErrorAction SilentlyContinue) { 'pg_dump' } else { Join-Path $PgBin 'pg_dump.exe' }
$Psql   = if (Get-Command psql    -ErrorAction SilentlyContinue) { 'psql' }    else { Join-Path $PgBin 'psql.exe' }

function Invoke-Native([string]$Exe, [string[]]$ArgList) {
  & $Exe @ArgList
  if ($LASTEXITCODE -ne 0) { throw "$Exe fallo (exit $LASTEXITCODE)." }
}

$Out = Join-Path $RepoRoot '.db-dump'
New-Item -ItemType Directory -Force $Out | Out-Null
$Utf8NoBom = New-Object System.Text.UTF8Encoding $false

# --- 3. Volcar PROD (solo lectura) ------------------------------------------
Write-Host '[1/5] Volcando esquema public de PROD...'
$SchemaFile = Join-Path $Out 'schema.sql'
Invoke-Native $PgDump @('--dbname', $Prod, '--schema-only', '--schema=public',
  '--no-owner', '--quote-all-identifiers', '--file', $SchemaFile)

# El esquema public y sus privilegios por defecto ya existen en un proyecto
# Supabase nuevo; recrearlos falla por permisos.
$schema = [IO.File]::ReadAllText($SchemaFile)
$schema = ($schema -split "`n" | Where-Object {
  $_ -notmatch '^CREATE SCHEMA "public";' -and
  $_ -notmatch '^COMMENT ON SCHEMA "public"' -and
  $_ -notmatch '^ALTER DEFAULT PRIVILEGES '
}) -join "`n"
[IO.File]::WriteAllText($SchemaFile, $schema, $Utf8NoBom)

$AuthFile = Join-Path $Out 'auth_data.sql'
$DataFile = Join-Path $Out 'public_data.sql'
if ($WithData) {
  Write-Host '[2/5] Volcando usuarios (auth.users, auth.identities)...'
  Invoke-Native $PgDump @('--dbname', $Prod, '--data-only', '--table=auth.users',
    '--table=auth.identities', '--quote-all-identifiers', '--file', $AuthFile)

  Write-Host '[3/5] Volcando datos public...'
  Invoke-Native $PgDump @('--dbname', $Prod, '--data-only', '--schema=public',
    '--quote-all-identifiers', '--file', $DataFile)
} else {
  Write-Host '[2-3/5] Sin datos (modo solo esquema).'
  [IO.File]::WriteAllText($AuthFile, '', $Utf8NoBom)
  [IO.File]::WriteAllText($DataFile, '', $Utf8NoBom)
}

# Trigger en auth.users: vive en el esquema auth, no entra en el dump de public.
$TriggerFile = Join-Path $Out 'auth_trigger.sql'
[IO.File]::WriteAllText($TriggerFile, @'
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
'@, $Utf8NoBom)

# --- 4. Vaciar y restaurar DEV (una sola transaccion) ------------------------
if (-not $Yes) {
  Write-Host ''
  Write-Host "Se va a VACIAR DEV ($DevRef): esquema public y auth.users." -ForegroundColor Yellow
  Write-Host 'Se pierden el seed y cualquier dato de prueba de DEV.'
  if ((Read-Host 'Escribe SI para continuar') -ne 'SI') { throw 'Cancelado por el usuario.' }
}

# Borra tablas, vistas, secuencias sueltas, funciones y tipos de public (las de
# extensiones se respetan) y vacia auth.users con sus dependientes. Se borran
# los objetos y no el esquema porque recrear `public` falla por permisos.
$WipeFile = Join-Path $Out 'wipe.sql'
[IO.File]::WriteAllText($WipeFile, @'
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
'@, $Utf8NoBom)

# session_replication_role = replica desactiva triggers y FKs durante la carga
# (asi no se disparan los triggers de auditoria ni handle_new_user).
Write-Host '[4/5] Vaciando y restaurando DEV (todo o nada)...'
Invoke-Native $Psql @('--dbname', $Dev, '--single-transaction', '-v', 'ON_ERROR_STOP=1', '--quiet',
  '--file', $WipeFile,
  '--file', $SchemaFile,
  '--command', 'SET session_replication_role = replica',
  '--file', $AuthFile,
  '--file', $DataFile,
  '--command', 'SET session_replication_role = origin',
  '--file', $TriggerFile)

# --- 5. Verificar --------------------------------------------------------------
Write-Host '[5/5] Verificando...'
$TablesSql = "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'"
$prodTables = & $Psql --dbname $Prod -At -c $TablesSql
$devTables  = & $Psql --dbname $Dev  -At -c $TablesSql
Write-Host "  Tablas public: PROD=$prodTables DEV=$devTables"
if ($prodTables -ne $devTables) { Write-Host 'DIFERENCIA EN TABLAS' -ForegroundColor Red }
elseif (-not $WithData) { Write-Host 'OK: estructura copiada.' -ForegroundColor Green }

$CountFile = Join-Path $Out 'count.sql'
[IO.File]::WriteAllText($CountFile, @'
SELECT format('SELECT %L, count(*) FROM %I.%I', schemaname || '.' || tablename, schemaname, tablename)
FROM pg_tables
WHERE schemaname = 'public' OR (schemaname = 'auth' AND tablename IN ('users', 'identities'))
ORDER BY 1
\gexec
'@, $Utf8NoBom)

if ($WithData) {
$prodCounts = & $Psql --dbname $Prod -At -F ' = ' --file $CountFile
$devCounts  = & $Psql --dbname $Dev  -At -F ' = ' --file $CountFile
$diff = Compare-Object $prodCounts $devCounts

Write-Host ''
$prodCounts | ForEach-Object { Write-Host "  $_" }
Write-Host ''
if ($diff) {
  Write-Host 'DIFERENCIAS ENCONTRADAS:' -ForegroundColor Red
  $diff | Format-Table -AutoSize
} else {
  Write-Host 'OK: PROD y DEV tienen los mismos conteos.' -ForegroundColor Green
}
}

if (-not $KeepDump) {
  Remove-Item -Recurse -Force $Out
  Write-Host 'Volcados borrados (.db-dump/).'
}
