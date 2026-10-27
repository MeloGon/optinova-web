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
| 4 | 2026-10-26 | `20261026170000_pacientes_genero_normalizado.sql` | `transforms/20261026170000_pacientes_genero.md` (dentro de la migración) | `"GENERO"` de `pacientes` pasa a `Masculino` / `Femenino` / `Otro` / NULL: PROD mezcla `H` (4,818), `M` (5,933), `Masculino`, `Femenino` y vacíos (3,455). H = Hombre, M = Mujer (confirmado por el dueño). Se agrega `CHECK` con esos tres valores. La migración desactiva `trg_pacientes_updated_at` mientras corrige los datos, para no sellar `updated_at` en todas las filas (en DEV se aplicó antes de añadir esa línea y `updated_at` se limpió a mano). Aplicado en DEV; PROD intacto hasta el corte |
| 5 | 2026-10-26 | `20261026190000_pacientes_id_automatico.sql` | `transforms/20261026190000_pacientes_id.md` | `"ID PACIENTE"` pasa a tener un valor por defecto: `pacientes_id_seq`, que arranca en el mayor ID existente + 1. Antes lo inventaba el navegador (16 dígitos al azar; podía chocar y 112 pacientes de PROD superan el límite exacto de JavaScript). Los IDs viejos no se tocan. Probado en DEV: inserts sin ID reciben consecutivos y un ID de 17 dígitos hace ida y vuelta exacto como texto. `ventas cortas`, `ventas` y `revisiones` tendrán lo mismo con su entregable |
| 6 | 2026-10-26 | `20261026210000_pacientes_columnas_limpias.sql` | `transforms/20261026210000_pacientes_columnas.md` (dentro de la migración) | Columnas de `pacientes` en `snake_case` sin espacios ni mayúsculas (`id`, `nombre`, `telefono`...). Teléfonos unificados: `telefono` toma el celular y, si falta, el otro; el distinto va a `telefono_secundario` (en PROD 4,954 pacientes tenían número solo en `TELEFONO 1`, que Flutter nunca mostraba). Se eliminan `ENTIDAD FEDERATIVA`, `OCUPACION` y `PERSONALIZADO 2`–`5` (vacías en los 15,259 pacientes de PROD) y la restricción `UNIQUE` repetida sobre el ID. Convención para las demás tablas: ver abajo. Aplicado en DEV; PROD intacto hasta el corte |
| 7 | 2026-10-26 | `20261026230000_revisiones_columnas_fk.sql` | `transforms/20261026230000_revisiones_columnas_fk.md` (dentro de la migración) | Columnas de `revisiones` en `snake_case` (`id`, `paciente_nombre`, `sucursal`, `motivo_consulta`...). `"FECHA"` (texto en español, formato variable) se elimina; `fecha_revision_actualizada` (ya `date`, llena en el 100% de las filas de PROD) se renombra a `fecha` y se vuelve `NOT NULL`. `"ID REFRACCION"` pasa a `id` con secuencia (igual que pacientes, cambio #5): ya no lo inventa el navegador. Se agrega `paciente_id` (FK a `pacientes.id`): se rellena por nombre único o, si el nombre se repite, por sucursal + fecha de registro del paciente (ver el transform para las cifras y los casos que quedan pendientes de revisión manual). `paciente_nombre` queda como respaldo. Se agregan `created_at`/`updated_at` (trigger, reutiliza `set_updated_at()` del cambio #3). Aplicado en DEV; PROD intacto hasta el corte |

### Convención de nombres de columnas (decisión del dueño, 2026-10-26)

`snake_case` en minúsculas, sin espacios, tildes ni mayúsculas. Español para los datos del negocio (`nombre`, `telefono`, `fecha_nacimiento`, `sucursal`), igual que las tablas (`pacientes`, `revisiones`); inglés para las columnas técnicas (`created_at`, `updated_at`). Cada tabla se renombra con el entregable que la usa (migración + transform + entrada aquí). `revisiones` ya quedó (cambio #7, E2.3b). Pendientes: `ventas` y `ventas cortas` (E2.5/E2.6), `pagos`, `egresos`, `armazones`, `resinas`, `vendedores`.

### Notas pendientes de RLS
- `perfiles."admin all perfiles"` usa `jwt_role()` (lee `app_metadata.role` del JWT), pero ningún usuario tiene ese dato: la política nunca aplica. No causa daño (la gestión de usuarios usa la Edge Function), pero el rol vive en dos lugares. Revisar en la Fase 4.
