# Plan de migración: Oftal Web (Flutter) → Optinova Web (Angular)

> Documento vivo. Se actualiza al cerrar cada entregable (checkbox + fecha + lección).
> Última actualización: 2026-10-13

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
| UI | PrimeNG (componentes) + Tailwind CSS (layout/espaciado), unidos con `tailwindcss-primeui` | shadcn_ui + Row/Column/Padding |
| Estado | Services + `signal`/`computed`. Sin NgRx por ahora | Riverpod Notifier |
| Formularios | Reactive Forms | TextEditingController + validators |
| Router | Angular Router + guards | go_router + redirect |
| Errores | Tipo `Result<T, E>` propio | fpdart `Either` |
| Backend (ahora) | Supabase vía `@supabase/supabase-js` | supabase_flutter |
| Backend (futuro) | NestJS, sobre la misma Postgres | — |
| Gráficas | PrimeNG Chart (Chart.js) | fl_chart |
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
- [ ] **E1.1 Herramientas**: Angular CLI global y cliente PostgreSQL 17 (`pg_dump`, `psql`)
- [ ] **E1.2 Clonar PROD → `optinova-db`**
  - Script `scripts/db/clone-prod-to-dev.ps1`: lee `PROD_DB_URL` y `DEV_DB_URL` del entorno; no guarda contraseñas
  - Orden: esquema `public` (tablas, RLS, funciones, grants), luego `auth.users` + `auth.identities`, luego datos `public`, luego trigger `on_auth_user_created`
  - Copiar la Edge Function `megadmin-users` a dev
  - Verificar que el conteo de filas por tabla sea igual en PROD y DEV
  - Registrar la fecha del snapshot en `docs/db-changes.md`
  - Guardar el esquema base como `supabase/migrations/<fecha>_baseline.sql`
- [ ] **E1.3 Scaffold Angular**: `ng new`, Tailwind, PrimeNG + tema, ESLint/Prettier, environments, `.gitignore` de secretos
- [ ] **E1.4 Arquitectura base**: `core/` (cliente Supabase, `Result`, modelos, repos abstractos + impl), `shared/`, layouts (auth, dashboard con sidebar + navbar), rutas

### Fase 2: Features (en orden de dificultad)
Cada feature es un entregable con modelo, repo, store, vistas y lección.
- [ ] **E2.1 Login + splash + guards + sesión + roles** (`supervisor`, `admin`, `megadmin`)
- [ ] **E2.2 Buscar paciente** (`/dashboard/search-patient`): primera tabla PrimeNG, búsqueda, paginación
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
| Fuga de datos de pacientes desde DEV | Secretos fuera de git; RLS activas en DEV igual que en PROD |
| Corte final no reproducible | Migraciones + transforms obligatorios; ensayo de corte antes |
| Proyecto DEV pausado por inactividad | Reactivar desde el dashboard |
| Tutoriales viejos de Angular (NgModules, `*ngIf`) confunden | Usar solo docs oficiales actuales (angular.dev, primeng.org) |

## 8. Registro

| Fecha | Entregable | Lección | Commit |
|---|---|---|---|
| 2026-10-13 | Proyecto `optinova-db` creado; plan inicial | — | — |
