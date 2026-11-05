# L18: Dashboard v2, datos por rol y señales

**Idea central:** un dashboard junta indicadores, pero cada usuario debe recibir únicamente los datos que le corresponden. La pantalla presenta el resumen; el servidor decide su alcance.

Solo teoría con comparaciones Flutter/Riverpod. Corte: Dashboard publicado en `85b9582`, `3e89319` y `f390165`; Flutter de referencia `7d3fa5f`. La prueba de roles y alcance reportada por Antigravity se encuentra en `docs/status.md`.

## 1. La pantalla existe en Flutter

Flutter tiene `DashboardView` y `DashboardProvider`: obtiene perfil y solicita en paralelo ventas del día, pacientes de la sucursal, ingresos, ventas recientes y serie diaria. Su proveedor suma pagos y agrupa métodos en el cliente. La consulta de ingresos del día no pasa sucursal en el proveedor consultado. Angular conserva el propósito y amplía la presentación con períodos, cobranza, stock y rankings.

| Flutter/Riverpod | Angular |
|---|---|
| `DashboardProvider` y `copyWith` | `DashboardStore` y `signal` de estado |
| Varias consultas de repositorios | `DashboardRepository.summary` llama `dashboard_summary` |
| Widgets y fl_chart | componentes y gráficas SVG C-23 propias |
| Actividad de auditoría para administradores | `dashboard_activity`, llamada separada autorizada |

## 2. Flujo: página, store, repositorio, SQL

La página provee `DashboardStore`; su vida acompaña la página, como un provider de pantalla que se descarta al salir. El store conserva período, sucursal, carga, error y resumen. Los `computed` extraen valores para la plantilla, de forma semejante a seleccionar campos de un estado Riverpod.

El repositorio transforma nombres de columnas y JSON de la función SQL a interfaces TypeScript y devuelve `Result`. La página no conoce supabase-js. La llamada envía período, sucursal y zona horaria de la empresa: «hoy» no debe depender de la medianoche UTC del navegador.

Si el usuario cambia de período dos veces rápidamente, `lastRequest` impide que una respuesta anterior pise la más reciente. No cancela la consulta; descarta el resultado viejo.

## 3. Rol en servidor, no solo en pantalla

`dashboard_summary` usa identidad y rol para calcular el alcance: vendedor sus datos, supervisor su sucursal, admin y megadmin global o sucursal elegida. Las secciones no autorizadas se devuelven como `null`; ocultar un widget sin limitar la respuesta no ofrecería la misma protección. El selector de sucursal es una petición al servidor, no un permiso que el cliente se concede a sí mismo.

La venta distingue quién la registró (`creado_por`) de quién fue elegido como vendedor (`autor_nombre`). El ranking usa el nombre comercial; no existe aquí una FK completa vendedor-perfil. Una diferencia de nombre puede afectar la asociación: está registrada como límite del modelo.

## 4. Períodos, comparación y gráficas

Hoy, siete días y mes comparan con el período anterior equivalente. Si el anterior es cero, la UI presenta «Sin comparación» en lugar de inventar un porcentaje. Las series alimentan barras, dona, minigráficas y ranking SVG; cambiar Armazones/Marcas cambia el `computed` con los datos ya recibidos.

Cobranza muestra deuda y antigüedad; stock bajo lista cantidades de 1 a 2 y cuenta agotados aparte. El diálogo de abono reutiliza `SalePaymentService`: tras guardar, el store vuelve a cargar el resumen. El servicio mantiene dos escrituras separadas, no una transacción única.

## 5. Evidencia y fuentes

Antigravity reportó prueba de los cuatro roles y contrastes de sucursal y métricas. Esta lección no repite esas pruebas ni consulta bases. Fuentes Angular: `features/dashboard/`, `core/data/supabase-dashboard.repository.ts`, migraciones #12–#16. Flutter: `lib/features/dashboard/` del repositorio [oftal_web](https://github.com/MeloGon/oftal_web/tree/7d3fa5f/lib/features/dashboard).

```bash
npm run pdf -- docs/lessons/18-dashboard.md
```
