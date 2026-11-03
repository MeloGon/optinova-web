# Transform #13: dashboard con periodos

Migración: `supabase/migrations/20261102230000_dashboard_periodos.sql`.

## Qué cambia en los datos

Nada. Solo se reemplaza la función `dashboard_summary(text, text)` (cambio #12) por
`dashboard_summary(text, text, text)`, con el parámetro `p_period` (`today`, `week` o `month`).
No toca tablas ni filas, así que no hay nada que transformar en el corte (Fase 5): basta aplicar la
migración después de la #12.

## Reglas del periodo (todas en la hora de la empresa, `p_tz`)

| Periodo | Actual | Se compara con |
|---|---|---|
| `today` | hoy | ayer |
| `week` | los últimos 7 días, hoy incluido | los 7 días anteriores |
| `month` | del día 1 a hoy | el mismo tramo del mes anterior (sin pasarse de su último día) |

- Las barras y las mini gráficas llevan un punto por día: los últimos 7 días (en `today` y `week`)
  o el mes en curso (en `month`).
- `kpis.my_sales` y `kpis.income` devuelven `total`, `previous_total` y `series`. `income` es
  `null` para el vendedor, igual que `payment_methods` y `expenses_month`.
- Saldo por cobrar y pacientes son una foto de hoy: no dependen del periodo.
- `payment_methods` (antes `payment_methods_today`) suma los pagos del periodo actual; su total
  coincide con `income.total`.
- `expenses_month` sigue siendo el mes en curso, sea cual sea el periodo.
- Un periodo distinto de los tres falla con `22023`.

## Verificado en DEV (2026-11-02)

- Admin, los tres periodos: la suma de métodos de pago es igual a los ingresos; `today` da 7 puntos
  de contexto y `month` da un punto por día transcurrido; el ayer y los 7 días previos salen de los
  mismos pagos.
- Vendedor en `month`: ventas propias con su serie; ingresos, métodos de pago y egresos en `null`.
- Periodo `year`: rechazado.
