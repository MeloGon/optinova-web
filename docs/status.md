# Estado del proyecto

> Tablero compartido entre agentes (Claude, Codex, Antigravity). Roles y reglas: `AGENTS.md`.
> Detalle de fases y checkboxes: `docs/migration-plan.md`.
> Cada agente actualiza esto al cerrar una tarea. Última actualización: 2026-10-26 (Codex, plan y lecciones de fundamentos).

## Hecho

- Fase 1 (infraestructura): herramientas, esquema clonado a DEV, seed, scaffold Angular, tokens y tema, core, layouts y rutas.
- E2.1 Login, sesión, guards y roles: commit `765c39e` del 2026-10-23; marcado y registrado en el plan. F07 (recorrido didáctico) sigue pendiente.
- Fase 0: lección F01 (TypeScript desde Dart) y generador de PDF, commit `8b30961` del 2026-10-23; marcado y registrado en el plan.
- Codex (2026-10-26): sincronizó `development`, comprobó los commits de F01 y E2.1 y actualizó fecha, checkboxes y Registro de `migration-plan.md`.
- Codex (2026-10-26): preparó F00, F02 y F03, una por una, con teoría y ejemplos comparados con Flutter/Dart, sin ejercicios. Markdown en `docs/lessons/fundamentos/`; PDF generados con `npm.cmd run pdf -- <lección.md>` en `docs/informes/` y revisados visualmente. Glosario ampliado. El dueño aprobó el commit el 2026-10-26; checkboxes de F00, F02 y F03 marcados.
- DB: 3 migraciones (baseline, RLS solo autenticados, `perfiles` sin auto-update).

## En curso

| Agente | Tarea | Desde |
|---|---|---|
| Codex | F00, F02 y F03 terminadas y commit aprobado; sin tarea documental activa | 2026-10-26 |

## Siguiente

1. Entrega aprobada: `docs(fundamentos): agrega F00, F02 y F03 y sincroniza el plan`.
2. Fase 0: lecciones F04–F06 (prioridad actual; las features están en pausa).
3. F07: recorrido guiado del código de E2.1.
4. E2.2 Buscar paciente (cuando termine la Fase 0).
5. E1.5b Componentes `C-xx`, a demanda de cada feature.

## Pendientes entre agentes

- (vacío) Formato: `[fecha] de <agente> para <agente>: detalle`.

## Pendientes conocidos

- Carpeta `supabase/transforms/` aún no existe (ninguna migración la ha necesitado).
- RLS: `perfiles."admin all perfiles"` usa `jwt_role()` que nunca aplica; revisar en Fase 4.
