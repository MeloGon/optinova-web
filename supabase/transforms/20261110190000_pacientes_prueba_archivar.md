# Transform #37: archivar los 24 pacientes de prueba de PROD

Migración: `supabase/migrations/20261110190000_pacientes_prueba_archivar.sql`. Corre después de la #36.
Decisión del dueño (2026-11-09): archivar, no borrar.

## Qué hace

Pone `archivado_en = now()` a 24 fichas de pruebas del equipo ("CLIENTE DE PRUEBA", "prueba", "SISTEMAS OPTOX...", años 2015 a 2020),
elegidas por id y solo si su nombre sigue siendo de prueba. No cambia ventas ni revisiones: las 16 ventas (S/. 1 958.00 en la copia
del 2026-11-09) quedan en el historial, vinculadas a fichas archivadas. Apaga y vuelve a encender los triggers de usuario de
`pacientes` para no mover `updated_at`.

## Prueba (DEV 2026-11-09)

Antes de aplicar, en transacción revertida: 24 fichas archivadas, ventas totales intactas (24 866 ventas, S/. 6 983 463.17).
Aplicada: pacientes activos de 15 126 a 15 102. Re-ejecutable (la segunda corrida no encuentra fichas activas).

## Reversión

`update pacientes set archivado_en = null where id in (...)` con la misma lista.
