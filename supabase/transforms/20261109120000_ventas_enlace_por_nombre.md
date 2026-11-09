# Transform #28: ventas sin id de paciente, enlazadas por nombre único

Migración: `supabase/migrations/20261109120000_ventas_enlace_por_nombre.sql`. Corre después de la #8.
Aprobada por el dueño el 2026-11-09.

## Por qué

Desde mediados de septiembre de 2025 Flutter dejó de guardar el id del paciente en las ventas
(`"ID PACIENTE"` queda en `NULL`): 1,807 ventas en la copia de PROD del 2026-11-08, 1,579 de 2026
(las de 2025 empiezan en septiembre). La #8 solo enlazó las que traían el id, así que estas no
aparecen en la ficha del paciente, ni sus abonos.

## Qué hace

Enlaza `paciente_id` cuando hay **una sola ficha** con ese nombre (comparación sin mayúsculas ni
espacios de más), el mismo criterio que la #7 aceptó para las revisiones. Solo ventas **sin ningún
id guardado**: las 45 que traían el id de un paciente borrado no se tocan.

| Grupo | Ventas |
|---|---|
| Enlazadas | 1,663 |
| Nombre repetido (2+ fichas) | 116 |
| Sin ficha con ese nombre | 28 |

326 de las enlazadas tienen la ficha registrada unos días **después** de la fecha de la venta
(casi siempre 1 a 4 días), compatible con ventas cuya fecha se corrigió a mano; se enlazan igual.

## Detalles

- Corrección de datos: se apagan `trg_ventas_descuento` y `trg_ventas_creado_por` mientras corre y
  se vuelven a encender. No cambia `creado_por`, montos ni descuentos.
- Re-ejecutable: solo toca ventas sin `paciente_id`; nunca cambia un enlace existente.
- Las 168 revisiones de la #27 no dependen de esta (los candidatos de esas revisiones tienen nombre
  repetido, y estas ventas solo se enlazan con nombre único).

## Verificado en DEV (2026-11-09)

Transacción revertida: 23,018 → 24,681 ventas con `paciente_id` (+1,663), 0 enlaces previos
cambiados, 0 otros campos cambiados, triggers de nuevo activos, segunda pasada `UPDATE 0`. Luego
aplicada en DEV.
