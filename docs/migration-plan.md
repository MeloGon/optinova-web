# Plan de migración: Oftal Web (Flutter) → Optinova Web (Angular)

> Documento vivo. Se actualiza al cerrar cada entregable (checkbox + fecha + lección).
> Última actualización: 2026-11-04

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
| Gráficas | SVG propios C-23: barras, dona, sparkline y ranking (`85b9582`, `3e89319`, `f390165`) | fl_chart |
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

**Cambio de método (2026-10-14, ajustado 2026-10-23).** Hasta E2.1 se avanzó rápido y el dueño no entendía el código (por ejemplo, `computed`). Se pausan las features y se hace la Fase 0 primero:
- Lecciones cortas, un tema por vez, **solo teoría con ejemplos** comparados con Dart (sin ejercicios, a pedido del dueño). Fuente en `docs/lessons/fundamentos/FNN-tema.md`.
- Cada lección se entrega también como **PDF imprimible** con `npm run pdf -- <lección.md>` (queda en `docs/informes/`, ignorado por git; se regenera en cualquier máquina). El dueño los junta en su propia documentación.
- Al terminar la Fase 0 se recorre el código de E2.1 archivo por archivo (F07) y se marca el checkbox de F07. E2.1 ya tiene su propio commit; el recorrido didáctico F07 fue revisado y aprobado por el dueño el 2026-10-26.
- Después, cada pieza nueva de una feature se explica antes de escribirla.

**Actualización del dueño (2026-10-26):** se retoma el desarrollo de features con E2.2 sin esperar F04–F06. La formación continúa en paralelo. F07 fue revisada y aprobada; F04–F06 siguen pendientes.

## 6. Fases y entregables

### Fase 0: Fundamentos (continúan en paralelo a las features)
- [x] F00: Mapa del ecosistema web: Node, npm, Angular CLI, el navegador (vs Dart SDK, pub, flutter CLI). Markdown y PDF preparados el 2026-10-26; commit aprobado por el dueño.
- [x] F01: TypeScript visto desde Dart (1): variables, tipos, null safety, funciones (2026-10-23, commit `8b30961`).
- [x] F02: TypeScript visto desde Dart (2): objetos, interfaces, clases, uniones, genéricos, `import/export`, async/await. Markdown y PDF preparados el 2026-10-26; commit aprobado por el dueño.
- [x] F03: HTML básico: el árbol de etiquetas como árbol de widgets. Markdown y PDF preparados el 2026-10-26; commit aprobado por el dueño.
- [ ] F04: CSS + Tailwind: Flexbox/Grid = Row/Column/Expanded; responsive = MediaQuery
- [ ] F05: Componentes y signals: `signal`, `computed`, `input`, `output`, plantilla (`@if`, `@for`, `{{ }}`, `(click)`)
- [ ] F06: Servicios e inyección: `inject`, `providedIn: 'root'` vs `providers: []`
- [x] F07: Recorrido guiado del código de E2.1 (login, sesión, guards; implementación ya registrada en `765c39e`). Markdown `F07-recorrido-e2-1.md` y PDF revisados y aprobados por el dueño el 2026-10-26; incluidos en el commit documental aprobado. F04–F06 siguen pendientes.

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
    - [x] **C-04 Date picker** (`7b6faf5`, 2026-10-30): `shared/ui/date-picker`, input enmascarado `dd/mm/aaaa`, calendario propio con CDK Overlay, grid ARIA, Limpiar/Hoy y límites de fecha; integrado en formularios de pacientes, revisiones, egresos y pagos, y en el filtro de ventas. Sin variante de rango ni navegación por teclado día a día en la grilla (pendientes). Inventario de diseño: `docs/design/design-log.md`. Claude reportó 10 tests nuevos (156 en total) y build limpio. E1.5b sigue abierto para los demás componentes.
    - [x] **C-22 Stepper** (`59fa465`, 2026-11-01): cabecera compartida de pasos actual/completos/futuros y regreso a pasos completos; usada en S-04 Vender. Documentado en L09. E1.5b continúa abierto para los componentes restantes.
    - [x] **C-14 Tabs** (`e6d7a6c`, 2026-11-02): `shared/ui/tabs/`, selección de secciones con contadores e inputs/output; la página sincroniza `?tab=` y monta el contenido. Usado en S-03 y documentado en L12. `e019946` agrega flechas cíclicas/Home/End, foco y paneles ARIA enlazados. E1.5b sigue abierto.
- [x] **E1.4 Arquitectura base** (2026-10-14): `core/` (cliente Supabase, `Result`, modelos, repos abstractos + impl), `shared/`, layouts (auth, dashboard con sidebar + navbar), rutas
  - [x] **E1.4a Core** (2026-10-14): `@supabase/supabase-js`, token `SUPABASE`, `Result` + `ok/err`, `AppError` + `toAppError` (server, network, notFound, unauthorized, unknown), `ConfigService` (moneda, sucursales con `active`, métodos de pago; regla 4b; OFTALMIC CENTER = cerrada con historial), `MoneyPipe`. Tests. Lección L02
  - [x] **E1.4b Layouts y rutas** (2026-10-14): auth-layout (S-01 panel de marca), dashboard-layout responsive con C-20 Sidebar y C-21 Topbar (`@lucide/angular`; `lucide-angular` no soporta Angular 22), todas las rutas de Flutter lazy con página "en construcción", 404, login visual. Menú con las secciones del diseño (decisión del dueño) en vez del hub "Configuración"; filtro por rol, sucursal y usuario reales en E2.1. Lección L03

### Fase 2: Features (en orden de dificultad)
Cada feature es un entregable con modelo, repo, store, vistas y lección.
- [x] **E2.1 Login + splash + guards + sesión + roles** (`supervisor`, `admin`, `megadmin`) (implementado 2026-10-14, commit `765c39e` del 2026-10-23): `AuthRepository` + `SupabaseAuthRepository`, `SessionStore` restaurado en `provideAppInitializer`, guards `authGuard`/`guestGuard`/`roleGuard`, login con Reactive Forms y `LoginStore`, menú y topbar con el usuario real, cerrar sesión (CDK Menu). Permisos de página iguales a Flutter. Antes: arreglo de seguridad en `perfiles` (cambio #2). Lección L04. Recorrido didáctico F07 revisado y aprobado.
- [x] **E2.2 Buscar paciente** (`/dashboard/search-patient`): tabla, búsqueda y paginación con URL como fuente de verdad (`fd4a892`), borrado básico con confirmación y toasts (`f78967d`), edición (`5135adf`); adaptación a IDs como texto y columnas limpias (`93b30a4`, `e3ef363`). No incluye la futura política de borrar/archivar por historial. Lección L05 revisada y commit aprobado.
- [ ] **E2.3 Agregar paciente + revisiones** (`/dashboard/add-patient`):
  - [x] **E2.3a Alta de paciente:** Reactive Forms, Field/Input, Segmented, validaciones, aviso de homónimos, vista previa y recientes (`ef10044`); teléfono secundario y columnas limpias (`e3ef363`). Lección L06 revisada y commit aprobado.
  - [x] **E2.3b Revisiones (implementación base):** Claude, commit `9ef2111` del 2026-10-27: migración #7 aplicada en dev, FK `revisiones.paciente_id`, nombre histórico de respaldo, `ReviewRepository`, diálogos Ver/Agregar/Editar y eliminación de medida con confirmación; P-05 Graduación reutilizable. Seis mejoras tras prueba manual del dueño; Claude reporta 117 tests y build limpio. Lección [L08](lessons/08-revisiones-medidas.md) y PDF preparados por Codex.
  - [x] **Correcciones de E2.3b:** `2cbea08` (2026-10-27): bloqueo de guardado con medidas inválidas, EJE entero 0–180, mensajes reactivos y detalle de LC/AV sin-con RX/CV/historia clínica. Claude reporta 122 tests en verde; prueba funcional de Antigravity aprobada. Reflejadas en L08 y PDF.
  - [ ] **Enlaces históricos de E2.3b:** resolver manualmente los casos ambiguos y verificar los conteos en el ensayo de corte.
- [x] **Eliminar/archivar según historial** (`b985095`, 2026-11-02): sin relaciones, confirmación; con medidas, supervisor o autorización P-04; con ventas, archivo por admin+ y restauración. Edge Function `patients-lifecycle`, auditoría y migración #11; Antigravity reportó aprobación funcional. Base de las acciones reutilizadas en S-03; la autorización de descuentos de Vender sigue separada.
- [x] **S-03 Ficha de paciente con pestañas Revisiones/Ventas/Pagos** (`e6d7a6c`, 2026-11-02, en `development`; publicación autorizada por el dueño): desbloqueada por E2.5/E2.6. Por decisión del dueño, página propia `/dashboard/search-patient/:id` con encabezado y C-14 Tabs, no panel partido. Primera ruta con parámetro de la app; `?tab=` conserva la sección. `PatientDetailPage`/`PatientDetailStore`, `PatientRepository.getById`, `Sale.patientId`/`SaleSearch.patientId`, `PaymentRepository.listByPatient`, extracción de `PatientLifecycleActions` y `ReviewsList`; desaparece `ViewMeasuresDialog`. Ventas filtradas por FK, paginadas de 10; detalle/abonos reutilizados de E2.5. Archivados: Restaurar para admin+ en lugar de Eliminar, recargando la ficha; Editar permanece. Empty-state de Revisiones unificado. Antigravity reportó aprobación funcional al 100%; Claude, 210 tests tras los dos arreglos y 216 tras `e019946`, con build limpio. Sin equivalente de pantalla en Flutter `7d3fa5f`. [L12](lessons/12-ficha-paciente.md) y PDF preparados por Codex. Sin nueva migración; Ir a vender no preselecciona paciente. `e019946` corrige la explicación de la FK, usa embed para pagos y completa teclado/paneles de Tabs; reflejado en L12.
- [x] **E2.4 Egresos** (`/dashboard/expenses`, `e0034f0`): repositorio y store, listado con paginación por URL, filtros de texto/sucursal, resumen de la página, diálogo único Nuevo/Editar y gestión de categorías. Aprobado por el dueño y publicado en `origin/development`; cierre consolidado el 2026-10-30 (commit fechado el 2026-10-27). Sin migración: esquema existente. Sin filtro por vendedor; una categoría en uso no se puede borrar por la FK actual. Claude reportó 135 tests y build limpio. [L10 Egresos](lessons/10-egresos.md) y PDF preparados el 2026-11-01.
- [x] **E2.5 Historial de ventas** (`/dashboard/sales-history`, `130d034`, 2026-10-30): S-05 con búsqueda conjunta por paciente/folio, fecha exacta y sucursal, estados con contadores, tabla y totales de la página, detalle y registro de abonos. `SaleRepository`, `PaymentRepository` y `SalesHistoryStore`; migración #8 aplicada en dev (`ventas`/`venta_items`, columnas limpias y FK de paciente). Publicado en `origin/development`. Sin CSV ni rango de fechas; crear, editar o anular ventas queda fuera del alcance de E2.5. Crear se incorporó después en E2.6. El nombre de otro registrador de pagos puede quedar vacío por RLS de perfiles. Claude reportó 146 tests antes de integrar C-04 y 156 con C-04, con build limpio. [L11 Historial de ventas](lessons/11-historial-ventas.md) y PDF preparados el 2026-11-01, incluidos los ajustes de `c5080e8` y `59fa465`.
- [x] **E2.6 Vender — nueva venta en tres pasos** (`/dashboard/sell`, `59fa465`, 2026-11-01): S-04 con C-22, PatientStep/ProductsStep/CheckoutStep, `SellStore`, catálogo con Buscar explícito y páginas de 10, carrito por unidades, precios editables, totales derivados, descuento accesible a supervisor o superior, stock agrupado por armazón después de crear venta y líneas, abono inicial opcional, vista previa y confirmación visual con folio y enlace al historial. Migraciones #9/#10 aplicadas en dev (catálogo e IDs/folios por secuencia); encabezado antes de detalles por la FK real de #8. Probado y aprobado por el dueño; Claude reportó 179 tests en verde y build limpio. [L09 Vender](lessons/09-vender.md) y PDF preparados. Sin alta de paciente dentro del flujo, aviso de deuda previa ni categoría Otros. El permiso simple de descuento no es la autorización P-04 completa; las escrituras siguen sin una transacción única.
  - [x] **Recibo PDF térmico** (`c5d5950`, 2026-11-01): servicio pdfmake, ticket 80 mm con logo/teléfono opcionales desde `ConfigService`, respaldo de nombre de sucursal y QR del folio. Descarga desde confirmación de venta y desde Historial; entregable separado de la vista previa HTML. Implementado en el historial local; consolidado el 2026-11-04 y contrastado tras pull a `e456cfe`. Los datos concretos de logo/teléfono de cada sucursal siguen por configurar; L09 conserva su contexto histórico; [L19 Recibo PDF](lessons/19-recibo-pdf.md) y PDF preparados.
  - [ ] **Autorización P-04 en descuentos de Vender:** el flujo de supervisor/servidor/auditoría ya existe para pacientes (`b985095`); falta reutilizarlo en Vender, que conserva el permiso simple por rol. No se marca cerrado por existir en otra feature.
- [x] **E2.7 Dashboard / S-02** (`/dashboard`): `85b9582` (2026-11-02, base por rol, #12), `3e89319` (2026-11-03, periodos/variación, #13) y `f390165` (2026-11-03, cobranza/stock/top/ranking, #14–#16). `dashboard_summary`/`dashboard_activity` calculan alcance en servidor: vendedor lo suyo, supervisor su sucursal, admin+ global o filtrado; lo no permitido vuelve null. SVG propios C-23 y C-10; cobranza reutiliza `SalePaymentService`. Antigravity reportó aprobación al 100% de Dashboard v2; hay observaciones menores registradas en estado. Commits presentes en `development`; publicación confirmada con el pull a `e456cfe` en esta revisión documental. [L18 Dashboard](lessons/18-dashboard.md) y PDF preparados.
- [x] **E2.8 Settings — pantallas implementadas; alcances adicionales pendientes.** Los ocho commits de código de `1c86dbd` a `e456cfe` están publicados en `origin/development`; pull confirmado el 2026-11-04, sin pérdida de docs locales. El dueño aprobó el commit y push documental el 2026-11-04.
  - [x] **Resinas** (`1c86dbd`, `settings/resins`): CRUD, formulario único, búsqueda/paginación en servidor, filtros de stock y contadores, auditoría best-effort; admin+. [L13](lessons/13-resinas.md) y PDF contrastados con la base publicada. Antigravity reportó reverificación; efecto del borrador corregido para depender solo de `q()`.
  - [x] **Armazones** (`9793658`, `settings/mounts`): CRUD, sucursal, stock y código de barras editable; #18 agrega la secuencia que faltaba al alta. Antigravity reconfirmó la creación en navegador. [L14](lessons/14-armazones.md) y PDF actualizados. IDs históricos transportados como texto desde `4268276` (#20); L14 describe la versión anterior.
  - [x] **Auditoría** (`eb1530a`, `settings/audit-logs`): visor, búsqueda OR, paginación en servidor y estadísticas globales; #17 retención mensual. Admin+ en navegación; políticas RLS del baseline sin cambio. [L15](lessons/15-auditoria.md) y PDF actualizados; búsqueda con guion bajo verificada por Antigravity.
  - [x] **Ventas por vendedor** (`d99ced3`, `settings/sales-by-seller` y `/:name`): mes/año/sucursal, agregados normalizados, detalle y simulación de comisiones; venta puntual en diálogo/abonos reutilizados. [L16](lessons/16-ventas-por-vendedor.md) y PDF actualizados. Antigravity probó resumen, comisiones, ruta y venta. Refactor `146155d` (#23): agregación y detalle paginado en servidor mediante RPC con verificación de rol; Antigravity aprobó 5 casos. L16 conserva la descripción histórica anterior al refactor. `monthRange` corregido a UTC. Sin selección individual de vendedores ni PDF de reporte de Flutter.
  - [x] **Reporte de pagos / Ingresos y egresos** (`1693555`, `settings/payments-report`): Día/Mes/Rango, pagos con venta embebida, egresos, KPI y tres tablas en memoria. [L17](lessons/17-reporte-pagos.md) y PDF actualizados. Antigravity aprobó roles/sucursal/períodos/secciones. Fallo de egresos ahora avisa con reintento; el neto sigue incompleto mientras falten datos. Alcance por sucursal reforzado en servidor mediante RPC `payments_report` desde `854d076` (#19); L17 describe la versión anterior.
  - [x] **Gestión de usuarios** (`53e72de`, `settings/users-management`): megadmin; listar/crear/editar, resetear contraseña y activar/desactivar por `megadmin-users`. Desactivación reversible en Auth, sin borrado; evita cambiar rol propio/desactivarse y conserva megadmins activos. Claude reportó pruebas API en dev, tests y build; prueba frontend final no registrada. [L20 Usuarios](lessons/20-usuarios.md) y PDF preparados; invitación por correo sin SMTP, fuera de alcance actual.
  - [x] **Correcciones compartidas de UI** (`55b74fe`): C-07 respeta alineaciones explícitas, efectos de buscador corregidos y errores C-02 asociados al input. Escape literal compartido incluido en las features. Claude reportó 346 tests/build limpio en el seguimiento; no es una ejecución propia de Codex.
  - [x] **Rutas/providers y conexión E2.8** (`e456cfe`): páginas reales lazy, guards por rol y repositorios registrados; reemplaza pendientes de esas seis pantallas.
  - [x] **Documentación L13–L17/plan/estado preparada y aprobada:** revisión terminada sobre `e456cfe`, cinco PDF y quince páginas revisadas; el dueño autorizó commit y push el 2026-11-04.
  - [ ] **Exportar CSV del reporte:** alcance separado; no implementado aquí ni en el provider Flutter consultado.
  - [x] **Features / app_config** (`98d9439`, `settings/features`): control global para admin+ y permiso individual de cambiar fecha para vendedores; supervisor gestiona su sucursal, admin+ todas. Migraciones #21/#22; Antigravity reportó 8 casos aprobados. Flutter tenía un flag global. Lección específica pendiente.

### Fase 3: Calidad y beta
- [ ] Tests de stores y repos (runner por defecto de Angular CLI)
- [x] **Checklist de paridad formalizado**: matriz de 14 áreas contra Flutter `7d3fa5f`, con diferencias y pendientes. Es un registro de alcance, no una aprobación integral de Fase 3 ni una prueba nueva. Features y el refactor de Ventas por vendedor se actualizaron con sus commits y pruebas reportadas por Antigravity.

  | Pantalla / ruta Angular | Referencia Flutter | Veredicto y diferencia relevante |
  |---|---|---|
  | Login `/auth/login` | login | Igual: sesión y acceso por rol; Antigravity aprobó E2.1. |
  | Buscar paciente `/dashboard/search-patient` | search_patient | Igual con mejora: búsqueda y paginación reflejadas en URL. |
  | Eliminar/archivar paciente | search_patient | Mejora: distingue historial y archivado, con autorización según el caso. |
  | Ficha `/dashboard/search-patient/:id` | search_patient, lista y diálogos | Mejora nueva: cabecera y pestañas; Flutter no tiene esa ficha. |
  | Egresos `/dashboard/expenses` | expenses | Igual en flujo principal; sin filtro por vendedor. Revisar el comportamiento de FK al borrar categorías. |
  | Historial `/dashboard/sales-history` | sales_history | Igual en flujo principal; sin CSV ni rango de fechas. |
  | Vender `/dashboard/sell` | sell | Mejora: permiso de descuento por rol y descuento de stock por cantidad. Falta autorización P-04 completa; Flutter descontaba una unidad por llamada. |
  | Dashboard `/dashboard` | dashboard | Mejora de una pantalla existente: alcance por rol en servidor, períodos y métricas adicionales. |
  | Resinas y Armazones `/dashboard/settings/resins`, `/mounts` | settings: inventarios | Igual con mejoras: tablas, filtros y código de barras editable en armazones. |
  | Auditoría `/dashboard/settings/audit-logs` | settings: audit logs | Mejora de visor existente: tabla, búsqueda y retención; no afirmar que Flutter carecía del visor. |
  | Ventas por vendedor `/dashboard/settings/sales-by-seller` | settings: ventas por vendedor | Simplificado: resumen y detalle, sin PDF ni selector individual; `146155d` agrega RPC y paginación en servidor. |
  | Reporte de pagos `/dashboard/settings/payments-report` | settings: ingresos y egresos | Igual con mejoras; sin CSV. Desde `854d076` el alcance por sucursal se decide en servidor con RPC. |
  | Usuarios `/dashboard/settings/users-management` | settings: usuarios | Mejora: crear, editar y activar/desactivar además de listar y restablecer contraseña. |
  | Features `/dashboard/settings/features` | settings: flag global | Mejora: flag global y permisos por vendedor/sucursal; `98d9439`, aprobado por Antigravity. |

  Los veredictos resumen el alcance, no garantizan igualdad campo por campo. Persisten pruebas de paridad, límites de API, alcance servidor y pendientes del plan.

- [ ] Deploy beta (hosting por decidir) apuntando a `optinova-db`
- [ ] Pruebas con usuarios reales en beta

### Fase 4: Rediseño de DB (opcional, cuando haya paridad)
- Pacientes ya recibió mejoras en sus entregables: fechas (#3), género (#4), IDs automáticos (#5) y columnas/teléfonos (#6). Revisiones incorporó columnas limpias, fecha, secuencia y FK en E2.3b (#7, dev). E2.5 aplicó la migración #8 en dev: `"ventas cortas"` pasó a `ventas` y el detalle antes llamado `ventas` a `venta_items`, con columnas limpias y FK de paciente; las fechas textuales se conservan como respaldo. E2.6 aplicó #9 (catálogo con columnas limpias) y #10 (secuencias de ID/folio de venta y de detalle) en dev. Las FK se incorporan con cada feature; no se posponen a esta fase. Lecciones L07 para #3–#6, L08 para #7, L11 para #8 y L09 para #9/#10; enlaces históricos ambiguos y ensayo de corte siguen pendientes.
- Cambios posteriores ya documentados en dev: #11 archivo de pacientes, #12–#16 Dashboard, #17 retención de auditoría y #18 secuencia de armazones. #17/#18 están versionadas en `eb1530a`/`9793658`; aplicación en dev según `docs/db-changes.md`. Esta tarea no ejecuta SQL ni modifica prod.
- [ ] Proponer mejoras adicionales: nombres, `created_at/updated_at`, índices, RLS
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
| Escalada de rol: la política "own profile update" dejaba que cualquier usuario se pusiera `rol = 'megadmin'` en `perfiles` | **Corregido** 2026-10-14 en DEV y PROD (cambio #2 en `db-changes.md`) |
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
| 2026-10-14 | E1.4b layouts y rutas | L03 | `feat(layouts): agrega layouts, sidebar, topbar y rutas` |
| 2026-10-23 | E2.1 login, sesión, guards y roles | L04 | `765c39e` — `feat(login): agrega sesión, guards y roles` |
| 2026-10-23 | Fase 0 y F01 TypeScript desde Dart (1) | F01 | `8b30961` — `docs(fundamentos): agrega fase 0 y lección F01` |
| 2026-10-26 | Sincronización del plan; F00 mapa del ecosistema web, Markdown y PDF preparados | F00 | Commit aprobado: `docs(fundamentos): agrega F00, F02 y F03 y sincroniza el plan` |
| 2026-10-26 | F02 TypeScript desde Dart (2), Markdown y PDF preparados | F02 | Commit aprobado: `docs(fundamentos): agrega F00, F02 y F03 y sincroniza el plan` |
| 2026-10-26 | F03 HTML como árbol de etiquetas, Markdown y PDF preparados | F03 | Commit aprobado: `docs(fundamentos): agrega F00, F02 y F03 y sincroniza el plan` |
| 2026-10-26 | F07 recorrido de E2.1, Markdown y PDF preparados; glosario ampliado | F07 | Aprobado: `docs(lessons): agrega lecciones de pacientes e informe de avance` |
| 2026-10-26 | E2.2 búsqueda, paginación, borrado básico y edición | L05 preparada | `fd4a892`, `f78967d`, `5135adf` |
| 2026-10-26 | Fechas de pacientes, IDs automáticos, columnas limpias y teléfonos | L07 preparada | `a7e6ae3`, `5135adf`, `93b30a4`, `e3ef363` |
| 2026-10-26 | E2.3a alta de pacientes y teléfono secundario | L06 preparada | `ef10044`, `e3ef363` |
| 2026-10-26 | Lecciones 05–07, informe de avance y entrega completa PDF/ZIP | L05–L07 e informe | Aprobado: `docs(lessons): agrega lecciones de pacientes e informe de avance` |
| 2026-10-27 | E2.3b: migración #7 en dev, repositorio, diálogos, P-05 y correcciones de validación/detalle; S-03 completa diferida | L08, Markdown y PDF revisados | Código: `9ef2111`, `2cbea08`. Documentación aprobada por el dueño para commit y push |
| 2026-10-27 | Numeración de la lección de revisiones corregida para continuar la secuencia 00–08; referencias y PDF actualizados; autorización de publicación del dueño | L08 | Mensaje autorizado: `docs(lessons): agrega lección de revisiones y medidas` |
| 2026-10-27 | E2.4 Egresos: listado, alta, edición y categorías; paginación por URL, filtros y resumen de la página; aprobado por el dueño. Publicación verificada y cierre consolidado el 2026-10-30 | L10 y PDF preparados el 2026-11-01 | `e0034f0` — `feat(egresos): agrega listado, alta, edición y categorías de egresos (E2.4)` |
| 2026-10-30 | C-04 Date picker: captura enmascarada, calendario CDK, Limpiar/Hoy y límites de fecha; integrado en los formularios y filtro de ventas. Rango y teclado día a día pendientes | Inventario en `docs/design/design-log.md` | `7b6faf5` — `feat(design): agrega C-04 Date picker y lo usa en toda la app` |
| 2026-10-30 | E2.5 Historial de ventas según S-05: filtros, estados, detalle y registrar pago; migración #8 en dev, tablas y FK de paciente | L11 y PDF preparados el 2026-11-01 | `130d034` — `feat(ventas): agrega historial de ventas con filtros, estado y registrar pago (E2.5)` |
| 2026-11-01 | E2.6 nueva venta en tres pasos: stock por cantidad, descuento por rol, catálogo paginado, vista previa, confirmación visual y migraciones #9/#10; recibo PDF y P-04 completo quedan separados | L09 y PDF preparados | `59fa465` — `feat(ventas): agrega Vender en 3 pasos con stock, descuento por rol y vista previa (E2.6)` |
| 2026-11-01 | Lecciones Vender, Egresos e Historial, comparadas con Flutter `7d3fa5f`; glosario e índice actualizados; informe actual y guía de Drive con biblioteca de 21 PDF/110 páginas | L09–L11, informe e índice, Markdown y PDF; ZIP local en `docs/informes/` | Commit y push autorizados expresamente por el dueño: `docs(lessons): agrega L09-L11 y prepara entrega para Drive` |
| 2026-11-02 | S-03 ficha de paciente: ruta `:id`, C-14 Tabs, Revisiones/Ventas/Pagos por ID y extracción de acciones/lista; dos arreglos de Antigravity incluidos. Mejora nueva respecto a Flutter, sin nueva migración | L12 Ficha de paciente, Markdown y PDF | `e6d7a6c` — `feat(pacientes): agrega la ficha de paciente con revisiones, ventas y pagos (S-03)`. Commit verificado; publicación de código y documentación autorizada por el dueño el 2026-11-02 |
| 2026-11-02 | Correcciones de S-03: pagos por paciente con embed sobre FK existente; teclado cíclico/Home/End y paneles ARIA de C-14. Claude reportó 216 tests y build limpio | L12/PDF actualizados antes de publicar | `e019946` — `fix(pacientes): corrige FK de pagos.listByPatient y agrega teclado a Tabs`. Publicación autorizada por el dueño |
| 2026-11-01 | Recibo PDF térmico: logo/teléfono opcionales de configuración, QR del folio, descarga en confirmación e Historial; pendiente antiguo consolidado el 2026-11-04 | Lección específica pendiente; L09 conserva el estado de su fecha | `c5d5950` — `feat(ventas): agrega recibo PDF del ticket con logo, teléfono y QR dinámicos` |
| 2026-11-02 | Eliminar/archivar por historial, P-04 para pacientes, servidor/auditoría y #11; consolidación de dependencia de S-03 | Explicación de reutilización en L12; no equivale a autorización de descuentos | `b985095` — `feat(pacientes): elimina o archiva paciente según su historial` |
| 2026-11-02 | E2.7 base por rol, alcance SQL, creado_por, #12 y gráficas SVG; Apariencia separada | Lección Dashboard pendiente | `85b9582` — `feat(dashboard): agrega el dashboard por rol con funciones SQL y gráficas SVG (E2.7)` |
| 2026-11-03 | E2.7 periodo, variación contra periodo anterior y mini gráficas; #13 | Lección Dashboard pendiente | `3e89319` — `feat(dashboard): agrega periodo, variación y mini gráficas a los KPI (E2.7)` |
| 2026-11-03 | E2.7 cobranza, stock bajo, productos/ranking; #14–#16 y servicio compartido de abonos; Antigravity aprobó Dashboard v2 | Lección Dashboard pendiente | `f390165` — `feat(dashboard): agrega cobranza, stock bajo, más vendido y ranking de vendedores (E2.7)` |
| 2026-11-04 | E2.8 Resinas: inventario CRUD, búsqueda, stock y auditoría | L13 y PDF | `1c86dbd` — `feat(resinas): agrega inventario de resinas con auditoría (E2.8)` |
| 2026-11-04 | E2.8 Armazones: inventario CRUD, sucursal, código de barras y secuencia #18 | L14 y PDF | `9793658` — `feat(armazones): agrega inventario de armazones y secuencia de id (E2.8)` |
| 2026-11-04 | E2.8 Auditoría: visor, búsqueda y estadísticas; retención pg_cron #17 | L15 y PDF | `eb1530a` — `feat(auditoria): agrega visor de auditoría con retención automática (E2.8)` |
| 2026-11-04 | E2.8 Ventas por vendedor: resumen, detalle, comisiones y diálogo de venta/abono | L16 y PDF | `d99ced3` — `feat(ventas): agrega ventas por vendedor con detalle y comisiones (E2.8)` |
| 2026-11-04 | E2.8 Ingresos y egresos: periodos, sucursal y tres secciones con totales derivados | L17 y PDF | `1693555` — `feat(pagos): agrega reporte de ingresos y egresos por periodo (E2.8)` |
| 2026-11-04 | C-07 respeta alineación explícita de encabezados; arreglos de escape/buscador/C-02 tras Antigravity | Explicado en L13–L17, especialmente L16; diseño actualizado | `55b74fe` — `fix(ui): corrige búsqueda con guión bajo y encabezados de tabla` |
| 2026-11-04 | E2.8 Usuarios: crear/editar, reset de contraseña y desactivación reversible con guardrails; Edge Function ampliada | Lección propia pendiente | `53e72de` — `feat(usuarios): agrega alta, edición y desactivación de usuarios (E2.8)` |
| 2026-11-04 | Conexión de páginas E2.8, guards, repositorios y providers | L13–L17 contrastadas con esta base tras pull | `e456cfe` — `chore(app): conecta rutas y proveedores de E2.8` |
| 2026-11-04 | Reporte de pagos: alcance por sucursal en servidor, migración #19 | L17 conserva el corte anterior | `854d076` — `feat(pagos): mueve el alcance de sucursal a una función server-side (RPC payments_report)` |
| 2026-11-04 | Armazones: ID como texto, cambio #20 | L14 conserva el corte anterior | `4268276` — `fix(armazones): Mount.id viaja como texto, no número` |
| 2026-11-04 | Features: permiso por vendedor y cambio de fecha, migraciones #21/#22 | Lección pendiente; prueba de Antigravity registrada en status | `98d9439` — `feat(features): agrega permisos de vendedor para cambiar fecha de venta` |
| 2026-11-04 | Ventas por vendedor: agregación y paginación en servidor, migración #23 | L16 conserva el corte anterior; prueba de Antigravity registrada en status | `146155d` — `refactor(ventas): ventas por vendedor deja de traer el mes completo` |
