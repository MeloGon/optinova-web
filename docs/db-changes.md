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
| 2 | 2026-10-14 | `20261014230000_perfiles_sin_auto_update.sql` | — (no cambia datos) | Se borra la política "own profile update" de `perfiles`: cualquier usuario podía cambiar su propio `rol` a `megadmin` y usar la Edge Function `megadmin-users`. Flutter no actualiza `perfiles` desde el cliente. Verificado en DEV (un vendedor lee su perfil; su UPDATE afecta 0 filas). Aplicado en DEV y en PROD (autorizado por el dueño) |
| 3 | 2026-10-26 | `20261026150000_pacientes_fechas_date.sql` | `transforms/20261026150000_pacientes_fechas.md` (la conversión va dentro de la migración) | `pacientes` pasa a tener `fecha_registro` y `fecha_nacimiento`, ambas `date`. `fecha_registro_actualizada` se renombra; `"FECHA DE NACIMIENTO"` (texto en 3 formatos) se convierte; se elimina `"FECHA DE REGISTRO"` (texto). Además agrega `created_at` (default `now()`; NULL en filas históricas) y `updated_at` (trigger `trg_pacientes_updated_at` con `public.set_updated_at()`). Solo DEV; PROD conserva las columnas viejas hasta el corte. Aplicado en DEV el 2026-10-26: 50 pacientes, todos con `fecha_registro` y `fecha_nacimiento`; el linter de seguridad no marca la función nueva |

### Notas pendientes de RLS
- `perfiles."admin all perfiles"` usa `jwt_role()` (lee `app_metadata.role` del JWT), pero ningún usuario tiene ese dato: la política nunca aplica. No causa daño (la gestión de usuarios usa la Edge Function), pero el rol vive en dos lugares. Revisar en la Fase 4.
