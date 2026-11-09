# Transform #31: archivar fichas de paciente sin nombre y sin historial

Migración: `supabase/migrations/20261110130000_pacientes_vacios_archivar.sql`. Corre después de la #30.
Aprobada por el dueño el 2026-11-09.

## Por qué

156 fichas con el nombre vacío, todas de OFTALVISION (2015 a 2025). 139 no tienen ventas ni
revisiones; 17 tienen 21 ventas históricas (montos de S/. 0 a 1,306, también sin nombre), 0 tienen
revisiones. No hay forma de saber quién era el cliente.

## Qué hace

Archiva (`archivado_en`) las fichas activas con nombre vacío **sin ventas ni revisiones**. No borra.
Las 17 con ventas se dejan como están. Las 114 ventas con nombre repetido y las 28 sin ficha
tampoco se tocan (decisión del dueño: el riesgo de asignarlas mal pesa más que el beneficio).

## Resultado en DEV (2026-11-09)

139 fichas archivadas.

## Deshacer

`update pacientes set archivado_en = null where btrim(coalesce(nombre,'')) = '' and archivado_en is not null;`
(en DEV esas 139 son las únicas archivadas con nombre vacío).
