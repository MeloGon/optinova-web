# Registro de cambios de base de datos

Cada cambio de esquema en `optinova-db` (`dqofpmpyxumkzlsqcjri`) se anota aquí con:
- migración (`supabase/migrations/...`)
- transform de datos viejo → nuevo (`supabase/transforms/...`)
- motivo

El corte final (Fase 5) reimporta PROD completo y aplica los transforms **en este orden**.

## Snapshots de PROD → DEV

| Fecha | Qué se copió | Verificado (conteos) |
|---|---|---|
| 2026-10-13 | Solo esquema `public` + trigger `on_auth_user_created` (`clone-prod-to-dev.ps1`). Datos: `supabase/seed.sql` (falsos) | 13 tablas, 20 políticas, 6 funciones, 4 triggers, 21 índices = PROD |

## Cambios de esquema

| # | Fecha | Migración | Transform | Motivo |
|---|---|---|---|---|
| 0 | 2026-10-13 | `20261013174053_baseline.sql` | — (mismo esquema que PROD) | Punto de partida |
| 1 | 2026-10-13 | `20261013190000_rls_solo_autenticados.sql` | — (no cambia datos) | 9 políticas abiertas a `public` pasan a `authenticated`: sin login ya no se lee ni escribe. Aplicado en DEV y en PROD (autorizado por el dueño) |
