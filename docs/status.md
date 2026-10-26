# Estado del proyecto

> Tablero compartido entre agentes (Claude, Codex, Antigravity). Roles y reglas: `AGENTS.md`.
> Detalle de fases y checkboxes: `docs/migration-plan.md`.
> Cada agente actualiza esto al cerrar una tarea. Última actualización: 2026-10-26 (Codex, recorrido F07 de E2.1).

## Hecho

- Fase 1 (infraestructura): herramientas, esquema clonado a DEV, seed, scaffold Angular, tokens y tema, core, layouts y rutas.
- E2.1 Login, sesión, guards y roles: commit `765c39e` del 2026-10-23; marcado y registrado en el plan. F07 (recorrido didáctico) sigue pendiente.
- Fase 0: lección F01 (TypeScript desde Dart) y generador de PDF, commit `8b30961` del 2026-10-23; marcado y registrado en el plan.
- Codex (2026-10-26): sincronizó `development`, comprobó los commits de F01 y E2.1 y actualizó fecha, checkboxes y Registro de `migration-plan.md`.
- Codex (2026-10-26): preparó F00, F02 y F03, una por una, con teoría y ejemplos comparados con Flutter/Dart, sin ejercicios. Markdown en `docs/lessons/fundamentos/`; PDF generados con `npm.cmd run pdf -- <lección.md>` en `docs/informes/` y revisados visualmente. Glosario ampliado. El dueño aprobó el commit el 2026-10-26; checkboxes de F00, F02 y F03 marcados.
- Codex (2026-10-26): preparó `docs/lessons/fundamentos/F07-recorrido-e2-1.md`, siguiendo el código actual desde modelos y repositorio hasta sesión, guards, login, menú y topbar. Solo teoría, comparaciones con Flutter/Riverpod/go_router y sin ejercicios. PDF generado en `docs/informes/F07-recorrido-e2-1.pdf` y revisado visualmente; glosario ampliado. Pendiente de revisión del dueño y aprobación de commit.
- DB: 3 migraciones (baseline, RLS solo autenticados, `perfiles` sin auto-update).

## En curso

| Agente | Tarea | Desde |
|---|---|---|
| Codex | F07 y su PDF preparados; espera revisión del dueño y aprobación de commit. Mensaje propuesto: `docs(fundamentos): agrega recorrido F07 de E2.1` | 2026-10-26 |
| Claude | E2.2a Buscar paciente (lista, búsqueda con Enter/botón, paginación 10/25/50/100) implementada con 53 tests en verde; pendiente de prueba manual del dueño y commit. Código: `core/{models,repositories,data}/*patient*`, `features/search-patient/`, `shared/ui/{badge,skeleton,empty-state,paginator,table}/`. Menú ⋯ con ítems deshabilitados hasta E2.2b/c y E2.3 | 2026-10-26 |
| Antigravity | Prueba manual de E2.1 finalizada con éxito (aprobada al 100%) | 2026-10-26 |

## Siguiente

1. Revisar F07 y aprobar el commit; su preparación no da por completadas F04–F06.
2. Fase 0: lecciones F04–F06 (prioridad actual; las features están en pausa).
3. Marcar F07 tras la revisión y el commit del recorrido guiado de E2.1.
4. E2.2 Buscar paciente (cuando termine la Fase 0).
5. E1.5b Componentes `C-xx`, a demanda de cada feature.

## Referencias

- App Flutter original (solo lectura, fuente de verdad del comportamiento): https://github.com/MeloGon/oftal_web. No usar rutas locales: el dueño trabaja en dos computadoras.
- E2.2 Buscar paciente en Flutter: `lib/features/search_patient/` (viewmodels, views, widgets).

## Pendientes entre agentes

- [2026-10-26] del Dueño para Claude y Codex: se retoma el desarrollo de features con E2.2 Buscar paciente (el dueño decidió no esperar F04–F06). Claude implementa el código. Codex lee `lib/features/search_patient/` del repo de Flutter (ver Referencias) y escribe `docs/lessons/10-buscar-paciente.md` (+ PDF) con lo que hace Flutter y su equivalente Angular, sin tocar `src/`.
- [2026-10-26] de Antigravity para Dueño / Claude: **Prueba manual y funcional de E2.1 en `ng serve` con los 4 usuarios del seed: APROBADA al 100%.**
  - **Prueba de credenciales erróneas:** Al ingresar contraseña equivocada, se muestra correctamente el mensaje traducido `"Correo o contraseña incorrectos."` en la alerta y se permanece en `/auth/login`.
  - **Prueba con los 4 usuarios (`OptinovaDev2026`):**
    - `vendedor@optinova.test`: entra a `/dashboard`, Topbar muestra `Vendedor Prueba`, `Vendedor`, `MEDILENT`; Sidebar muestra exactamente **6 ítems**; intento de entrar a `/dashboard/settings/resins` es bloqueado por `roleGuard` y redirige a `/dashboard`.
    - `supervisor@optinova.test`: entra a `/dashboard`, Topbar muestra `Supervisor Prueba`, `Supervisor`, `MEDILENT`; Sidebar muestra exactamente **7 ítems** (+ `Ingresos y egresos`); accede a `/dashboard/settings/payments-report` correctamente y es bloqueado por `roleGuard` al intentar entrar a `/dashboard/settings/users-management`.
    - `admin@optinova.test`: entra a `/dashboard`, Topbar muestra `Admin Prueba`, `Admin`, `OFTALVISION`; Sidebar muestra exactamente **12 ítems** (+ Inventario y Administración); bloqueado al intentar entrar a `/dashboard/settings/users-management`.
    - `megadmin@optinova.test`: entra a `/dashboard`, Topbar muestra `Mega Admin Prueba`, `Megadmin`, `OFTALVISION`; Sidebar muestra todos los **13 ítems** (+ Súper administración con `Usuarios`); acceso permitido a todas las rutas protegidas.
  - **Persistencia de sesión:** Al recargar la página (F5) en `/dashboard`, `provideAppInitializer` restaura la sesión de Supabase de inmediato sin parpadeos ni pérdidas de datos de perfil.
  - **Cierre de sesión:** Al desplegar el menú de usuario (CDK Menu) y pulsar `"Cerrar sesión"`, redirige limpiamente a `/auth/login`, borra la sesión y `authGuard` bloquea cualquier intento de regresar a `/dashboard`.
  - **Conclusión:** Paridad total contra Flutter alcanzada. E2.1 validado y listo sin observaciones.

## Pendientes conocidos

- Carpeta `supabase/transforms/` aún no existe (ninguna migración la ha necesitado).
- RLS: `perfiles."admin all perfiles"` usa `jwt_role()` que nunca aplica; revisar en Fase 4.
