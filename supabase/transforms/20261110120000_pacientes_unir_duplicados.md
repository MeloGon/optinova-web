# Transform #30: unir fichas de paciente duplicadas (evidencia fuerte)

Migración: `supabase/migrations/20261110120000_pacientes_unir_duplicados.sql`. Corre después de la #28.
Aprobada por el dueño el 2026-11-09 (criterio: teléfono y nacimiento juntos).

## Por qué

Flutter dejaba registrar a la misma persona varias veces y se siguen creando en 2026. Causa
revisiones ambiguas (123 en 84 nombres) y historiales partidos en dos fichas.

## Qué hace

Une fichas activas con el **mismo nombre**, el **mismo teléfono** (7+ dígitos) y la **misma fecha de
nacimiento** (se ignora si es igual a la fecha de registro: dato falso). Cadenas A-B, B-C se resuelven
como un solo grupo.

- Sobrevive la ficha con `fecha_registro` más reciente (empate: id mayor).
- Las demás se archivan (`archivado_en`, reversible).
- Sus ventas y revisiones pasan a la sobreviviente.
- `pacientes_unidos` guarda `id_viejo`, `id_nuevo` y los ids de ventas y revisiones movidas, para deshacer.
- Se apagan `trg_ventas_descuento` y `trg_ventas_creado_por` mientras corre (corrección de datos).

Se ignoran: nombre vacío, "CLIENTE DE PASO", "PRUEBA", datos AGY, fichas ya archivadas.

## Resultado en DEV (2026-11-09)

| Dato | Valor |
|---|---|
| Fichas archivadas | 34 |
| Grupos (sobrevivientes) | 32 |
| Ventas movidas | 29 |
| Revisiones movidas | 17 |
| Ventas totales | 24 870 (sin cambio) |

Probada antes en transacción revertida. Re-ejecutable: una segunda corrida no encuentra más.

## Fuera de alcance (revisión manual del dueño)

Fichas con el mismo nombre que coinciden en una sola cosa (solo teléfono ~97 pares, solo nacimiento
~10) o solo en nombre: pueden ser familiares u homónimos. No se tocan.

## Deshacer

Para cada fila de `pacientes_unidos`: `ventas.paciente_id` / `revisiones.paciente_id` de los ids
guardados vuelven a `id_viejo`, y `pacientes.archivado_en` de `id_viejo` vuelve a `NULL`.
