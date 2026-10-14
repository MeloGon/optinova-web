# Plan de migración: Oftal Web (Flutter) → Optinova Web (Angular)

> Documento vivo. Se actualiza al cerrar cada entregable (checkbox + fecha + lección).
> Última actualización: 2026-10-14

## 1. Contexto

- **Sistema actual:** `oftal_web`, Flutter web, **en producción con usuarios reales**.
  - Repo: https://github.com/MeloGon/oftal_web
  - Arquitectura: MVVM por feature + Clean (datasource → repository impl → repository abstracto), Riverpod 3 (generator), freezed, fpdart (`Either`), go_router, shadcn_ui, supabase_flutter.
- **Sistema nuevo:** `optinova-web`, Angular. Repo: https://github.com/MeloGon/optinova-web
- **Doble objetivo:**
  1. Reemplazar por completo la app Flutter.
  2. Que el dueño (dev Flutter/Dart, sin experiencia en JS/HTML/CSS) aprenda el stack web. Cada entregable se explica comparándolo con Flutter.

## 2. Decisiones tomadas

| Tema | Decisión | Equivalente Flutter |
|---|---|---|
| Framework | Angular (última estable): standalone components, signals, control flow `@if/@for`, zoneless | Flutter |
| Lenguaje | TypeScript estricto | Dart |
| UI | **Sistema de diseño propio** (Claude Design, ver `docs/design/`) implementado con Tailwind CSS v4 + `@angular/cdk` + `@angular/aria` (headless oficiales, MIT). Primario personalizable en runtime y modo oscuro. Se descartó PrimeNG (desde 2026 exige licencia PrimeUI) y spartan-ng (comunidad pequeña) | shadcn_ui + Row/Column/Padding |
| Estado | Services + `signal`/`computed`. Sin NgRx por ahora | Riverpod Notifier |
| Formularios | Reactive Forms | TextEditingController + validators |
| Router | Angular Router + guards | go_router + redirect |
| Errores | Tipo `Result<T, E>` propio | fpdart `Either` |
| Backend (ahora) | Supabase vía `@supabase/supabase-js` | supabase_flutter |
| Backend (futuro) | NestJS, sobre la misma Postgres | — |
| Gráficas | Por decidir en E2.7 (candidato: Chart.js, MIT) | fl_chart |
| PDF | pdfmake | paquete `pdf` |
| CSV | papaparse | paquete `csv` |
| Fechas/números | `Intl` + pipes de Angular | intl |

## 3. Ambientes Supabase

| Ambiente | Proyecto | Ref | Uso |
|---|---|---|---|
| **PROD (viejo)** | `oftal-test-web` (el nombre engaña: ES producción) | `gutgxjgfjbodznzjiqtm` | App Flutter. **Prohibido escribir.** Solo lectura de esquema/datos para copiar. |
| **DEV / futura prod** | `optinova-db` | `dqofpmpyxumkzlsqcjri` | App Angular. Se pueden cambiar esquema, RLS y funciones. |

- Organización "Optinova", plan free (2 proyectos máximo, ya usados).
- Plan free: el proyecto se pausa tras 7 días sin actividad; se reactiva desde el dashboard.
- `optinova-db` contendrá **datos reales de pacientes**: sus claves se tratan como secretos de producción.

### Inventario de PROD (2026-10-13)
- Tablas `public`: `app_config`, `armazones`, `audit_logs`, `categorias_egresos`, `egresos`, `pacientes`, `pagos`, `perfiles`, `resinas`, `revisiones`, `vendedores`, `ventas`, `"ventas cortas"`.
- ~90k filas, ~37 MB. 6 usuarios en `auth.users`. 0 archivos en Storage.
- Funciones `public`: `audit_actor_email`, `audit_log_payment`, `audit_log_sale`, `audit_log_sale_date`, `handle_new_user`, `jwt_role`.
- Trigger `auth.users.on_auth_user_created → public.handle_new_user()` (vive en esquema `auth`: no entra en un dump de `public`, se recrea aparte).
- Edge Function: `megadmin-users` (`verify_jwt: true`), usada por gestión de usuarios.
- Extensiones: `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `supabase_vault` (estándar).
- Migraciones registradas: solo desde 2026-05. Las tablas base son anteriores, así que **las migraciones no reconstruyen la DB**: hace falta un dump completo.
- La mayoría de las tablas **no tienen `created_at`/`updated_at`**, así que no se puede detectar qué cambió. Por eso el corte final es una **reimportación completa**, no un delta (ver Fase 5).

## 4. Reglas de oro

1. **Nunca escribir en PROD** (`gutgxjgfjbodznzjiqtm`). Ni migraciones, ni RLS, ni datos.
2. La app Flutter sigue siendo la oficial hasta el corte (Fase 5).
3. Todo cambio de esquema en `optinova-db` se hace con **una migración SQL versionada** en `supabase/migrations/` **y** con su **script de transformación de datos** (viejo → nuevo) en `supabase/transforms/`, registrado en `docs/db-changes.md`. Sin eso, el corte final no se puede reproducir.
4. Secretos (`anon/publishable key`, contraseñas de DB) nunca en git: van en `.env` / `environment.local.ts`, ambos ignorados.
5. Commits cortos, en español, con prefijo convencional (`feat(login): agrega guard de rutas`), **sin** trailers `Co-Authored-By`.
6. No se hace commit hasta que el dueño haya probado manualmente el entregable.

## 5. Método de trabajo por entregable

1. Claude implementa el entregable en pasos pequeños.
2. Claude explica cada pieza nueva con su equivalente en Flutter (qué es, para qué sirve, cómo se relaciona).
3. Se escribe la lección en `docs/lessons/NN-tema.md` y se amplía `docs/flutter-to-angular.md`.
4. El dueño prueba en `ng serve` y lo compara con la app Flutter.
5. Commit (y push cuando el dueño lo pida). Se marca el checkbox aquí.
6. Opcional: un mini ejercicio si el dueño lo pide.

## 6. Fases y entregables

### Fase 0: Fundamentos (lecciones, en paralelo a la Fase 1)
- [ ] L00: Mapa del ecosistema web: Node, npm, Angular CLI, el navegador (vs Dart SDK, pub, flutter CLI)
- [ ] L01: TypeScript visto desde Dart: tipos, clases, interfaces, null safety, async/await, genéricos, módulos `import/export`
- [ ] L02: HTML básico: el árbol de etiquetas como árbol de widgets
- [ ] L03: CSS + Tailwind: Flexbox/Grid = Row/Column/Expanded; responsive = MediaQuery

### Fase 1: Infraestructura
- [x] **E1.1 Herramientas** (2026-10-13: Angular CLI 22.2.2, Node 24.18, PostgreSQL client 17.11): Angular CLI global y cliente PostgreSQL 17 (`pg_dump`, `psql`)
- [x] **E1.2 Clonar la ESTRUCTURA de PROD → `optinova-db`** (sin datos reales)
  - Script `scripts/db/clone-prod-to-dev.ps1`: lee `PROD_DB_URL` y `DEV_DB_URL` del entorno; no guarda contraseñas
  - Por defecto copia solo el esquema `public` (tablas, RLS, funciones, grants) y el trigger `on_auth_user_created`
  - `-WithData` copia además usuarios y datos reales; se reserva para el corte final (Fase 5)
  - [x] Edge Function `megadmin-users` copiada a dev (2026-10-13)
  - [x] Esquema base guardado en `supabase/migrations/20261013174053_baseline.sql`
- [x] **E1.2b Datos de prueba**: `supabase/seed.sql` (re-ejecutable) con ~50 registros falsos por tabla y 4 usuarios de prueba (`megadmin`, `admin`, `supervisor`, `vendedor`); credenciales en el encabezado del archivo
- [x] **E1.3 Scaffold Angular** (2026-10-14): `ng new` (Angular 22.2, zoneless, Vitest), Tailwind v4, `@angular/cdk` + `@angular/aria`, pantalla de prueba con primario dinámico. Environments: `environment.ts` (prod, sin claves) y `environment.local.ts` (dev, ignorado) vía `fileReplacements`. Lección L00
- [ ] **E1.5 Sistema de diseño**: pedido D-001 a Claude Design, tokens a `styles.css` (`@theme`), componentes base en `src/app/shared/ui/` construidos a medida que cada feature los necesite
  - [x] **E1.5a Tokens y tema** (2026-10-14): `optinova-theme.css` → `src/styles.css`, `primary-scale.ts` → `core/theme/`, `ThemeService` (modo claro/oscuro/sistema, densidad, primario; guardado en `localStorage`), fuentes Geist, script anti-destello en `index.html`. Lección L01
  - [ ] **E1.5b+ Componentes** `C-xx` en `src/app/shared/ui/`, a medida que cada feature los necesite
- [ ] **E1.4 Arquitectura base**: `core/` (cliente Supabase, `Result`, modelos, repos abstractos + impl), `shared/`, layouts (auth, dashboard con sidebar + navbar), rutas
  - [x] **E1.4a Core** (2026-10-14): `@supabase/supabase-js`, token `SUPABASE`, `Result` + `ok/err`, `AppError` + `toAppError` (server, network, notFound, unauthorized, unknown), `ConfigService` (moneda, sucursales con `active`, métodos de pago; regla 4b; OFTALMIC CENTER = cerrada con historial), `MoneyPipe`. Tests. Lección L02
  - [ ] **E1.4b Layouts y rutas**: auth-layout, dashboard-layout con C-20 Sidebar y C-21 Topbar reales (`lucide-angular`), rutas lazy

### Fase 2: Features (en orden de dificultad)
Cada feature es un entregable con modelo, repo, store, vistas y lección.
- [ ] **E2.1 Login + splash + guards + sesión + roles** (`supervisor`, `admin`, `megadmin`)
- [ ] **E2.2 Buscar paciente** (`/dashboard/search-patient`): primera tabla (C-07), búsqueda, paginación
- [ ] **E2.3 Agregar paciente + revisiones** (`/dashboard/add-patient`): Reactive Forms, validación, máscaras
- [ ] **E2.4 Egresos** (`/dashboard/expenses`): CRUD + categorías
- [ ] **E2.5 Historial de ventas** (`/dashboard/sales-history`): filtros, pagos
- [ ] **E2.6 Vender** (`/dashboard/sell`): formulario complejo, cálculos, diálogo de autorización (supervisor/admin), recibo PDF
- [ ] **E2.7 Dashboard** (`/dashboard`): métricas y gráficas
- [ ] **E2.8 Settings**
  - [ ] Resinas (`settings/resins`)
  - [ ] Armazones (`settings/mounts`)
  - [ ] Reporte de pagos (`settings/payments-report`) + exportar CSV
  - [ ] Ventas por vendedor (`settings/sales-by-seller`)
  - [ ] Features / app_config (`settings/features`)
  - [ ] Auditoría (`settings/audit-logs`)
  - [ ] Gestión de usuarios (`settings/users-management`, Edge Function `megadmin-users`)

### Fase 3: Calidad y beta
- [ ] Tests de stores y repos (runner por defecto de Angular CLI)
- [ ] Checklist de paridad pantalla por pantalla contra Flutter
- [ ] Deploy beta (hosting por decidir) apuntando a `optinova-db`
- [ ] Pruebas con usuarios reales en beta

### Fase 4: Rediseño de DB (opcional, cuando haya paridad)
- [ ] Proponer mejoras: nombres, `created_at/updated_at`, renombrar `"ventas cortas"`, índices, RLS
- [ ] Cada cambio = migración + transform + entrada en `db-changes.md` (regla 3)

### Fase 4b: Multi-empresa / SaaS (mapeado, NO se implementa todavía)
Objetivo: vender el sistema a otras ópticas. Cada empresa crea sus sucursales y configura su moneda.
- [ ] Tabla `organizaciones` (empresa) y `sucursales` con campo `activa` (hoy las sucursales son texto fijo en `ConfigService`: OFTALVISION y MEDILENT activas; OFTALMIC CENTER cerrada, con historial en pacientes, revisiones y ventas cortas). Al migrar, cada texto `SUCURSAL` pasa a `sucursal_id`; ojo con valores `null` y `''` en `revisiones` y `egresos`
- [ ] `organizacion_id` en todas las tablas + RLS por organización (cada empresa solo ve lo suyo)
- [ ] Configuración por empresa: moneda (código ISO + símbolo + formato), métodos de pago, zona horaria, logo, color primario
- [ ] Registro de empresas nuevas y primer usuario admin; invitación de usuarios
- [ ] Al corte (Fase 5), los datos actuales se asignan a la organización "Optinova"
- Momento recomendado: junto con el rediseño de DB (Fase 4), antes del corte, para migrar los datos una sola vez.

**Reglas desde ya** (para no tener que rehacer después):
1. Nada de sucursales, moneda ni métodos de pago escritos a mano en el código: siempre se leen de un servicio de configuración (`core/config`), aunque hoy devuelva valores fijos.
2. Todo monto se muestra con un único pipe/servicio de moneda; nunca se escribe `S/.` en una plantilla.
3. Todo texto de sucursal viene de datos, no de un `enum`.

### Fase 5: Corte a producción
- [ ] Ensayo completo en `optinova-db`: vaciar, reimportar PROD fresco y aplicar los transforms en orden
- [ ] Ventana de corte: congelar la app Flutter (modo solo lectura o aviso), reimportación final, verificación de conteos
- [ ] Apuntar la app Angular de producción a `optinova-db` y retirar Flutter
- [ ] Mantener el proyecto viejo pausado unas semanas como respaldo; luego borrarlo y crear un nuevo proyecto DEV

### Fase 6: Backend NestJS
- [ ] API NestJS sobre la misma Postgres; auth con JWT de Supabase o propio
- [ ] Nuevas implementaciones de repos en Angular (`*HttpRepository`) sin tocar stores ni vistas
- [ ] Evaluar monorepo (Nx) para compartir tipos front/back

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| Escribir por error en PROD | Regla 1; scripts reciben URLs explícitas; MCP: usar siempre el ref de DEV para escribir |
| Fuga de datos de pacientes desde DEV | DEV solo tiene datos falsos; secretos fuera de git |
| RLS abiertas: 9 tablas (`pacientes`, `revisiones`, `ventas`, ...) tienen política `true` para el rol `public`, así que **anon** (sin login) puede leer y modificar todo | **Corregido** 2026-10-13 en DEV y PROD (cambio #1 en `db-changes.md`). Pendiente a futuro: restringir por rol (hoy cualquier usuario con sesión puede borrar) |
| Corte final no reproducible | Migraciones + transforms obligatorios; ensayo de corte antes |
| Proyecto DEV pausado por inactividad | Reactivar desde el dashboard |
| Tutoriales viejos de Angular (NgModules, `*ngIf`) confunden | Usar solo docs oficiales actuales (angular.dev, tailwindcss.com) |

## 8. Registro

| Fecha | Entregable | Lección | Commit |
|---|---|---|---|
| 2026-10-13 | Proyecto `optinova-db` creado; plan inicial | — | — |
| 2026-10-13 | E1.1 herramientas, E1.2 estructura clonada, E1.2b seed | — | — |
| 2026-10-14 | E1.5a tokens y tema | L01 | `feat(design): agrega tokens de D-001 y servicio de tema` |
| 2026-10-14 | E1.3 scaffold + environments | L00 | `feat(app): agrega environments de dev y prod` |
| 2026-10-14 | E1.4a core | L02 | `feat(core): agrega cliente Supabase, Result, errores y config` |
