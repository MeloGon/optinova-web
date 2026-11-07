# Plan: clonar PROD a DEV y reaplicar las migraciones (ensayo de corte)

Estado: **en curso** (iniciado 2026-11-06, Claude). Retomable desde cualquier computadora.

## Reglas

- PROD (`gutgxjgfjbodznzjiqtm`) **solo SELECT**. Flutter sigue vivo sobre PROD, durante y después del corte (respaldo).
- DEV (`dqofpmpyxumkzlsqcjri`) es descartable: se vacía y se llena. El seed (usuarios de prueba) se pierde.
- Las contraseñas **nunca** van al chat ni al repo. Viven en `.env.db` (ignorado por git) en la máquina que ejecute.
- Cada migración se aplica una por una con comprobación entre cada paso. Vaciar DEV requiere "sí" explícito del dueño.

## Fases

1. [x] **Huella de PROD** (solo lectura): ver abajo.
2. [x] **Arreglar `scripts/db/clone-prod-to-dev.ps1`** (2026-11-06, sin ejecutar: la Mac no tiene `pg_dump`/`psql`/`pwsh`): ya no genera baseline, lee `.env.db`, y vacía DEV (objetos de `public` + `auth.users` en cascada) dentro de la misma transacción de carga, pidiendo escribir `SI` antes (`-Yes` lo omite). `.env.db` agregado a `.gitignore`. **Falta probarlo** en la otra computadora.
3. [x] **Clonar PROD a DEV con datos** (2026-11-06, `scripts/db/clone-prod-to-dev.sh --with-data`, versión bash para Mac; el `.ps1` queda para Windows). Autorizado por el dueño. 15 tablas con los mismos conteos en PROD y DEV; PROD solo se leyó. Ver "Huella base de DEV".
4. [x] **Reaplicar migraciones** (2026-11-06): #1 y #2 ya estaban en PROD; se aplicaron #3 a #25 una por una con `psql --single-transaction`, huella comprobada tras cada una. Todas pasaron. Dos ajustes salieron del ensayo (ver "Hallazgos del ensayo").
5. [x] **Comparar la huella de DEV con la de PROD** (2026-11-06): ventas, sumas, pagos y pacientes idénticos a la huella base; diferencias explicadas abajo. Advisors sin hallazgos nuevos salvo el INFO esperado de `venta_items_huerfanos`; RPC probadas con un admin real.
6. [ ] **Fase 4b** (tabla `sucursales`) sobre los datos reales.

## Huella de PROD (2026-11-06)

| Dato | Valor |
|---|---|
| `ventas cortas` (ventas) | 24 848 filas, 24 848 `ID REMISION` distintos |
| Suma `TOTAL` | 6 978 353.17 |
| Suma `DESCUENTO` | 240 729.00 |
| Suma `TOTAL CON DESCUENTO` | 6 737 728.47 |
| Suma `A CUENTA` | 6 679 813.50 |
| Suma `RESTA` | 59 919.09 |
| Ventas con `ID PACIENTE` numérico | 23 059 |
| Ventas enlazables a un paciente real | 23 014 (**45 con id numérico que no existe**) |
| `ventas` (detalle, futuro `venta_items`) | 28 837 filas, 24 711 ventas distintas |
| Suma `PRECIO` del detalle | 4 309 821.50 |
| `pagos` | 1 614 filas, 1 282 ventas distintas, suma `monto` 432 485.50 |
| Ventas sin detalle | 257 |
| **Detalle huérfano (sin venta)** | **191 filas** |
| Pagos huérfanos | 0 |

Sucursal en texto (PROD): pacientes 9327 OFTALVISION / 5349 MEDILENT / 609 OFTALMIC CENTER; revisiones 11134 / 4412 / 484 + **1328 null + 1 vacía**; ventas 17314 / 6876 / 658; egresos 310 / 326 + **8 null**.

## Huella base de DEV tras la clonación (2026-11-06, antes de reaplicar migraciones)

Flutter sigue vivo: PROD ganó unas ventas entre la huella inicial y el volcado (+5 ventas, +690 en `TOTAL`). Esta tabla es la referencia para comparar tras cada migración.

| Dato | Valor |
|---|---|
| ventas (`ventas cortas`) | 24 853 filas, 24 853 remisiones |
| `TOTAL` / `DESCUENTO` / `TOTAL CON DESCUENTO` | 6 979 043.17 / 240 749.00 / 6 738 398.47 |
| `A CUENTA` / `RESTA` | 6 680 483.50 / 59 919.09 |
| detalle (`ventas`) | 28 843 filas, 24 716 ventas distintas, `PRECIO` 4 310 341.50 |
| `pagos` | 1 621 filas, monto 433 155.50 |
| detalle huérfano / ventas sin detalle | 191 / 257 (iguales a la huella inicial) |
| otras tablas | pacientes 15 288, revisiones 17 364, egresos 647, armazones 2 955, resinas 219, audit_logs 2 898, perfiles 6, auth.users 6 |

El historial `supabase_migrations.schema_migrations` de DEV conserva 24 entradas de antes del vaciado: no refleja el esquema real (hoy es el de PROD).

## Riesgos ya detectados para ventas

1. **191 filas de detalle sin venta (120 remisiones; 121 filas son de 2026).** Causa: Flutter borra el detalle de una venta eliminada por `"ID REMISION" = <folio>` (nunca coincide) y además inserta detalle y cabecera sin transacción. **Resuelto en la migración #8 (2026-11-06):** las filas pasan a `venta_items_huerfanos` con `motivo` (`duplicado_probable` 22, `revisar` ~12, `sin_pista` el resto) y la FK se crea con `ON DELETE CASCADE`. Probado en DEV con datos falsos; falta correrlo con los datos reales. Flutter seguirá creando huérfanas mientras viva: repetir la limpieza en el corte.
2. **45 ventas con id de paciente que ya no existe**: quedan con `paciente_id` nulo y `paciente_id_legado` como respaldo (la migración #8 ya lo contempla). Verificar que el texto del paciente se conserve.
3. **257 ventas sin detalle**: no rompen nada, pero deben seguir existiendo tras migrar (comparar conteo de `ventas`).
4. Las 25 migraciones nunca corrieron sobre datos reales. Puede haber más fallos como el 1; por eso se aplican de una en una.

## Comprobación tras cada migración

Conteos de `ventas`, `venta_items` (+ huérfanos guardados), `pagos`, y sumas de `total`, `descuento`, `a_cuenta`, `resta`, `monto`: deben coincidir con la huella, salvo cambios a propósito.

## Qué hace falta del dueño al llegar a las fases 3 y 4

1. Crear `.env.db` en la raíz del repo (ignorado por git):
   ```
   PROD_DB_URL=postgresql://postgres.gutgxjgfjbodznzjiqtm:<password>@<host-session-pooler>:5432/postgres
   DEV_DB_URL=postgresql://postgres.dqofpmpyxumkzlsqcjri:<password>@<host-session-pooler>:5432/postgres
   ```
   (Supabase -> el proyecto -> Connect -> Session pooler.)
2. Tener el cliente PostgreSQL 17 instalado (`C:\Program Files\PostgreSQL\17\bin`).
3. Dar el "sí" explícito antes de vaciar DEV.

## Hallazgos del ensayo (2026-11-06)

Resultado: las 24 migraciones (#3 a #25) corren sobre una copia de PROD con datos reales sin errores y sin perder dinero ni filas. Cifras finales en DEV: 24 853 ventas (`total` 6 979 043.17, `resta` 59 919.09), 28 652 líneas más 191 apartadas (suman las 28 843 originales; `precio` 4 289 657.50 + 20 684.00 = 4 310 341.50), 1 621 pagos (433 155.50), 15 288 pacientes, 17 364 revisiones, 2 955 armazones.

1. **Detalle huérfano (#8):** 191 filas / 120 remisiones a `venta_items_huerfanos`: 22 `duplicado_probable`, 12 `revisar`, 86 `sin_pista`. Nada se borra. El registro de auditoría confirma la causa: 31 eventos `delete_sale` (2026-06-15 a 2026-10-30) coinciden por folio con 31 remisiones huérfanas (47 líneas), guardadas en `venta_eliminada_en`; la auditoría de ventas eliminadas solo existe desde 2026-06-15, por eso no cubre las demás. Son detalle de ventas eliminadas a propósito, no detalle que le falte a otra venta (solo 4 de las 257 ventas sin detalle son de 2026). Decisión del dueño: archivar, no borrar ni enlazar. Causa y arreglo en `db-changes.md` (#8).
2. **Folio de 17 dígitos (#10), corregido:** 3 ventas de dic-2025 tienen folio de 17 dígitos; contarlas hacía que la secuencia empezara en 90 887 116 289 227 530 y todo folio nuevo saldría así. La migración ahora ignora folios de más de 9 dígitos: la secuencia arranca en 997 834.
3. **Revisiones (#7):** 16 912 de 17 364 enlazadas a su paciente; 452 sin enlazar (62 sin nombre, 42 sin paciente, 348 con nombre repetido sin desempate).
4. **Pacientes (#3):** 7 129 fechas de nacimiento convertidas de 7 129, ninguna sin entender. Los 1 063 con nacimiento de hace menos de 3 años se dejan (decisión del dueño: clientes que no dieron su fecha y quedaron con la de hoy). El único nacimiento en el futuro (2026-12-03) pasa a 2026-01-01, regla dentro de la migración #3.
5. **Ids de 17 dígitos (#5, #8, #10, #18):** las secuencias de pacientes, ventas, líneas y armazones arrancan sobre 9e16 porque los ids viejos eran al azar. Funciona (bigint llega a 9e18) y la app ya trata esos ids como texto.
6. **Historial de migraciones de Supabase en DEV** (`supabase_migrations.schema_migrations`) no refleja lo aplicado con `psql`.
7. **PROD gana datos mientras Flutter vive:** hay que repetir clonación + huérfanas en la ventana final del corte.

## Repetición completa en limpio (2026-11-07)

Tras ajustar las migraciones #3 (fecha de nacimiento futura), #8 (huérfanas, `venta_eliminada_en`) y #10 (folios de 17 dígitos) y agregar la #26, se repitió el proceso entero: vaciar DEV, clonar PROD con datos (`clone-prod-to-dev.sh --with-data`, mismos conteos en las 15 tablas) y aplicar #3 a #26 una por una. Todas corrieron sin errores y la huella (ventas 24 853 / 6 979 043.17, líneas 28 652, pagos 1 621 / 433 155.50, pacientes 15 288, revisiones 17 364, armazones 2 955) no se movió en ninguna.

Estado final verificado: 191 líneas huérfanas apartadas (22 / 12 / 86 remisiones por motivo, 31 con borrado probado), 0 nacimientos en el futuro, 16 912 revisiones enlazadas, siguiente folio 997 834, FK con `ON DELETE CASCADE`, las 8 funciones y 4 triggers de la #26, un solo trabajo de cron. La batería de pruebas de la #26 (venta completa, stock insuficiente sin dejar nada a medias, validaciones, abonos, sobrepago, archivar/borrar productos, revisión y venta sin líneas) se repitió con el mismo resultado, y los advisors no muestran hallazgos nuevos. Las migraciones están listas para el ensayo final del corte.
