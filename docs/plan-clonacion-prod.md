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
3. [ ] **Clonar PROD a DEV con datos** (`-WithData`). Necesita `.env.db` con `PROD_DB_URL` y `DEV_DB_URL` (Session pooler, cada una con su ref).
4. [ ] **Reaplicar migraciones #1 a #25** en orden (excepto `*_baseline.sql`, que ya es el esquema clonado), con comprobación entre cada una.
5. [ ] **Comparar la huella de DEV con la de PROD.** Toda diferencia se explica o se corrige.
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

## Riesgos ya detectados para ventas

1. **191 filas de detalle sin venta.** La migración #8 (`20261027200000_ventas_columnas_fk.sql`, línea 96) agrega la FK `venta_items.venta_id -> ventas.id` y fallará con esas filas. Se probó solo con el seed, que no tenía huérfanos. **Decisión pendiente (no borrar):** guardarlas en una tabla de respaldo `venta_items_huerfanos` antes de agregar la FK, y revisar a qué venta pertenecían.
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
