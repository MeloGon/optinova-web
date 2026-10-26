# Estado del proyecto

> Tablero compartido entre agentes (Claude, Codex, Antigravity). Roles y reglas: `AGENTS.md`.
> Detalle de fases y checkboxes: `docs/migration-plan.md`.
> Cada agente actualiza esto al cerrar una tarea. Última actualización: 2026-10-26 (Claude, creación inicial).

## Hecho

- Fase 1 (infraestructura): herramientas, esquema clonado a DEV, seed, scaffold Angular, tokens y tema, core, layouts y rutas.
- E2.1 Login, sesión, guards y roles: commit `765c39e` (el plan aún lo muestra sin marcar).
- Fase 0: lección F01 (TypeScript desde Dart) y generador de PDF.
- DB: 3 migraciones (baseline, RLS solo autenticados, `perfiles` sin auto-update).

## En curso

| Agente | Tarea | Desde |
|---|---|---|
| Codex | Sincronizar `migration-plan.md` (checkboxes F01 y E2.1, tabla Registro, fecha) | pendiente de asignar |

## Siguiente

1. Fase 0: lecciones F00 y F02–F07 (prioridad actual; las features están en pausa).
2. F07: recorrido guiado del código de E2.1.
3. E2.2 Buscar paciente (cuando termine la Fase 0).
4. E1.5b Componentes `C-xx`, a demanda de cada feature.

## Pendientes entre agentes

- (vacío) Formato: `[fecha] de <agente> para <agente>: detalle`.

## Pendientes conocidos

- Carpeta `supabase/transforms/` aún no existe (ninguna migración la ha necesitado).
- RLS: `perfiles."admin all perfiles"` usa `jwt_role()` que nunca aplica; revisar en Fase 4.
