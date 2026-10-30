# Transform #8: `ventas` / `venta_items` — nombres limpios + FK a pacientes

Acompaña a `supabase/migrations/20261027200000_ventas_columnas_fk.sql`. La conversión de datos va
dentro de la propia migración (mismo criterio que los cambios #3, #4, #6 y #7); este documento
explica el porqué y deja las cifras para revisar en el corte (Fase 5).

## Qué cambia

1. **Se intercambian los nombres de las tablas.** La tabla con la venta/remisión completa se
   llamaba `"ventas cortas"` y la del detalle línea por línea se llamaba `"ventas"` — al revés de
   lo esperado (un Flutter dev leería "ventas" como la tabla principal). Ahora:
   - `ventas` = la venta/remisión (antes `"ventas cortas"`; = `SalesModel`)
   - `venta_items` = cada línea vendida (antes `"ventas"`; = `SalesDetailsModel`; si viniera de
     Flutter/freezed sería una `Sale` con su `List<SaleItem>`)
2. **Columnas en `snake_case`**, mismo criterio que pacientes (#6) y revisiones (#7): sin espacios,
   mayúsculas ni tildes. Ningún dato se pierde ni se recalcula; son renames 1 a 1.
3. **`paciente_id`** (FK a `pacientes.id`) en `ventas`. A diferencia de revisiones (#7), que solo
   tenía el *nombre* del paciente y necesitó dos pasadas de coincidencia, `ventas` ya trae
   `"ID PACIENTE"` con el id real (la app lo guarda al vender desde que existe el id automático,
   cambio #5): se renombra a `paciente_id_legado` (texto, respaldo) y se castea directo a
   `paciente_id` cuando es numérico y existe ese paciente. Sin ambigüedad que resolver a mano.
4. **Ninguna columna se elimina.** `"FECHA"` (texto, formato variable) y `"FECHA DE VENTA"` pasan a
   `fecha_legado` / `fecha_venta_legado` como respaldo, pero no se borran: a diferencia de
   `pacientes`/`revisiones`, no se verificó en PROD que las columnas `date` equivalentes
   (`fecha_actualizada`, `fecha_venta_iso`, `fecha_ventas_actualizada`) estén 100% llenas. Se deja
   para cuando se audite contra PROD, antes del corte.
5. **Funciones de auditoría actualizadas.** `audit_log_sale()` y `audit_log_sale_date()`
   (triggers `trg_audit_sale` / `trg_audit_sale_date` sobre `ventas`) leían columnas por su nombre
   viejo (`NEW."FOLIO REMISION"`, `OLD."FECHA"`...). Un rename de columna no reescribe el cuerpo de
   una función plpgsql (son solo texto), así que se recrearon con los nombres nuevos. Los triggers
   en sí no se tocaron: Postgres los vincula a la columna por posición, no por nombre, y ese rename
   no cambia la posición.
6. **FK nueva `venta_items.venta_id → ventas.id`.** Verificado antes de migrar: 0 filas huérfanas
   en DEV (`select count(*) from ventas v where not exists (... venta_items ...)`), así que se
   puede exigir sin filtrar nada.

## Qué NO cambia en este entregable

- `pagos` ya estaba en `snake_case` con FK (`id_remision → ventas."ID REMISION"`, ahora
  `ventas.id` automáticamente: el rename de tabla/columna no rompe una FK existente, Postgres la
  sigue por OID). No se tocó.
- `resinas`/`armazones`: `venta_items.id_oftalmico`/`id_montura` no se convirtieron en FK todavía
  (quedan para su propio entregable de inventario).
- No se agregó `created_at`/`updated_at`: esta migración es de lectura (E2.5); se evalúa si hace
  falta cuando E2.6 escriba ventas nuevas.

## Cifras en PROD (de `docs/migration-plan.md`, a verificar de nuevo en el ensayo de corte)

`"ventas cortas"` ya trae `"ID PACIENTE"` en 23,017 de 24,807 filas válidas. Falta medir cuántas de
esas 23,017 castean a un `pacientes.id` real (podrían quedar algunas con el paciente ya borrado o
el id mal escrito) — se mide en el ensayo de corte (Fase 5), no en DEV: en DEV (datos de prueba) no
hay ninguna fila con el dato puesto, así que el `update` de esta migración no enlaza nada por ahora.

## Verificado en DEV (2026-10-27)

- `ventas`: 50 filas (todas de `seed.sql`); `venta_items`: 100 filas; `pagos`: 76 filas — mismos
  conteos que antes de migrar.
- `select count(*) from venta_items v where not exists (select 1 from ventas vc where vc.id = v.venta_id)`
  → 0, antes de agregar la FK.
- Advisor de seguridad de Supabase: mismos 3 avisos de antes (funciones sin `search_path` fijo que
  ya existían: `audit_actor_email`, `handle_new_user`, `jwt_role`) y los avisos esperables de
  `SECURITY DEFINER` en las funciones de auditoría (de diseño, no una regresión de este cambio).
