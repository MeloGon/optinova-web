# Transform #35: perfiles por organización (multi-empresa, paso 2c)

Migración: `supabase/migrations/20261110170000_perfiles_por_organizacion.sql`. Corre después de la #34.

## Qué hace

- `handle_new_user` crea el perfil con la organización de `raw_user_meta_data.organizacion_id`. La Edge Function `megadmin-users`
  la manda al crear el usuario. Sin ese dato el alta falla (no adivina empresa).
- Quita el DEFAULT de `perfiles.organizacion_id`.
- Elimina la política `"admin all perfiles"` (`jwt_role() = 'admin'`): daba acceso total a todos los perfiles a cualquier admin sin
  mirar la empresa. Nadie la usaba (lee `app_metadata.role`). Queda `"own profile read"`.

## Orden de despliegue (importante)

Desplegar las Edge Functions nuevas **antes o junto con** esta migración: la versión vieja de `megadmin-users` crea usuarios sin
`organizacion_id` y con la #35 aplicada fallaría. Las otras dos funciones no dependen de ella.

## Cambios en Edge Functions (mismo paso)

- `megadmin-users`: `create` acepta `organizacionId` (por defecto la del megadmin), valida que exista y que la sucursal sea de esa
  empresa; `update` valida la sucursal contra la empresa del usuario; `list` devuelve `organizacion_id`; la auditoría lleva la
  organización del usuario afectado.
- `authorize-discount`: el supervisor que autoriza debe ser de la misma empresa que el vendedor (megadmin sirve en cualquiera);
  la auditoría lleva la organización.
- `patients-lifecycle`: un paciente de otra empresa se trata como inexistente (404); el supervisor que autoriza borrar revisiones
  debe ser de la empresa del paciente; la auditoría lleva la organización del paciente.

## Prueba (transacción revertida, DEV 2026-11-09)

Alta con `organizacion_id` en metadata: crea el perfil en esa empresa. Alta sin metadata: falla por NOT NULL. Tras el rollback el
DEFAULT y la política siguen como antes.
