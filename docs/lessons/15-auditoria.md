# L15: Auditoría, visor y retención automática (E2.8)

**Idea central:** registrar cambios, consultarlos y retirar los antiguos son tres responsabilidades distintas. El catálogo emite eventos; una página permite leerlos; un trabajo programado de PostgreSQL aplica la retención.

Solo teoría y comparación con Flutter/Riverpod, sin ejercicios. Corte: 2026-11-04, `development` en `e456cfe`, confirmado con pull. Visor y #17 publicados en `eb1530a`; migración aplicada en dev según registro. Las pruebas citadas son de Claude/Antigravity; esta entrega documental no consulta DB y espera autorización propia de commit. Flutter: `7d3fa5f240ba705c312d9ab2c5a054f815aab80c`.

## 1. Qué muestra Flutter y qué cambia Angular

Flutter ya tiene `AuditLogsView`, `AuditLogsNotifier` y un repositorio. La vista presenta eventos en `PagedListCard`: cada tarjeta muestra usuario, acción, fecha y detalles interpretados; para algunos cambios de armazón muestra valores anteriores y nuevos. Tiene selector de acción y filtro de usuario separados. No es una función ausente del original.

Angular usa `/dashboard/settings/audit-logs`: tabla C-07, buscador único y una franja con estadísticas globales. Se reutilizan paginador, skeleton y empty-state; no incorpora botones para editar o eliminar eventos a mano.

| Flutter | Angular publicado |
|---|---|
| `NotifierProvider<AuditLogsNotifier, AuditLogsState>` | `AuditLogsStore` provisto por la página |
| Acción y usuario como filtros separados | Texto OR sobre acción, entidad, ID y correo |
| Lista de tarjetas con detalles específicos | Tabla con detalle convertido a texto |
| Offset y `hasMore` | URL, `range` y total exacto |
| Sin franja de retención en la vista consultada | RPC `audit_logs_stats()` del cambio #17 |

## 2. Contrato de escritura y contrato de consulta

`AuditLogRepository` define `log`, `search` y `stats`. Los stores de Resinas/Armazones usan el primero; `AuditLogsStore` usa los otros dos. La implementación Supabase traduce `entityId`, `userEmail` y `createdAt` a nombres de columnas como `entity_id` y `created_at`.

`log` inserta acción, entidad, ID, correo y detalle JSON. Para catálogo se lanza después de guardar y sin esperar que tenga éxito. Este criterio best-effort existía en el flujo Flutter de armazones; también se usa ahora para resinas. No garantiza que cada cambio tenga evento ni que la operación de negocio se revierta si falta el registro.

Los eventos de ventas o pagos pueden proceder de triggers o funciones de servidor, como ya registra `db-changes.md`. Compartir tabla no significa que todos sus eventos tengan el mismo origen o nivel de garantía. El correo pasado por un cliente tampoco equivale por sí solo a identidad verificada en servidor.

## 3. Buscar y paginar sin traer todo el historial

La página reconstruye `AuditLogSearch` desde `?q=&page=&size=`. Solo aplica el texto al pulsar Buscar o Enter. Los tamaños admitidos son 10, 25, 50 y 100, con 25 por defecto.

`search` convierte el texto en un filtro OR de cuatro campos: `action`, `entity`, `entity_id` y `user_email`. Buscar `create_resin` consulta el identificador guardado, no su traducción Crear resina. La utilidad de escape compartida corrige el caso del guion bajo, que antes se interpretaba incorrectamente.

La consulta ordena por `created_at` descendente y solicita una ventana `range`. El texto es la parte aplicada de la URL; el campo de edición puede tener un borrador. No hay búsqueda sobre el contenido de `detail`, filtro de fechas en esta UI ni selector independiente de acción como el que Flutter sí ofrecía.

`AuditLogsStore` carga página y estadísticas en paralelo, e ignora respuestas antiguas con `lastRequest`. Si falla la página, guarda el mensaje de error. Si solo falla la RPC de estadísticas, conserva el valor anterior; una tabla actualizada no prueba que la franja también se haya refrescado.

## 4. La franja describe toda la tabla

`audit_logs_stats()` devuelve `total`, `oldest` y `pending_cleanup`. Cuenta la tabla completa: buscar una entidad o ir a otra página no reduce esas cifras al filtro visible. Si no hay eventos, la fecha más antigua puede ser `null`.

Esto permite distinguir tres cantidades: las filas dibujadas en la página, las coincidencias del buscador y el total de registros conservados. Confundirlas haría parecer que Limpiar búsqueda modifica el historial.

La tabla traduce acciones conocidas con un diccionario y muestra las desconocidas tal como llegan. `formatDetail` convierte pares clave/valor en texto y serializa objetos con `JSON.stringify`; no reconstruye los chips ni los diffs especializados de Flutter. Un detalle vacío se muestra con un guion; tampoco significa que no hubiera cambio.

## 5. Migración #17: el scheduler limpia sin una pantalla abierta

La retención pedida por el dueño habilita `pg_cron`, crea `cleanup_audit_logs()` y registra el job:

```sql
select cron.schedule(
  'cleanup_audit_logs',
  '0 3 1 * *',
  'select public.cleanup_audit_logs();'
);
```

La expresión significa minuto 0, hora 3, día 1 de cada mes, en la zona horaria del scheduler. El SQL no fija la hora local de Lima. No se debe prometer una hora local concreta sin comprobar esa configuración.

La función elimina filas con `created_at < now() - interval '3 months'`. Son tres meses de calendario, no una cantidad fija de 90 días. La condición se evalúa cuando corre el job. Como el trabajo es mensual, una fila que cruza el umbral después de la ejecución puede esperar hasta la siguiente: no es un borrado instantáneo al cumplir tres meses.

`pending_cleanup` cuenta lo que supera el umbral al consultar las estadísticas; no es una predicción exacta del volumen que habrá en el próximo mes. Las filas que se borren se retiran de verdad; no hay restauración desde la página.

La migración revoca ejecutar la limpieza a `public`, `anon` y `authenticated`; queda para el scheduler. Concede la RPC de estadísticas a `authenticated`. La administración no necesita dejar un navegador conectado para que ocurra el mantenimiento. Referencia: [pg_cron en Supabase](https://supabase.com/docs/guides/database/extensions/pg_cron).

## 6. Visor protegido y seguridad de los datos

La ruta exige admin o superior, igual que las otras pantallas de inventario. Eso protege la navegación normal, pero el baseline de `audit_logs` permite leer e insertar a usuarios autenticados. El guard no cambia esas políticas ni vuelve inmutables las escrituras del cliente.

La distinción es útil desde Flutter: ocultar un botón según el provider de sesión no reemplaza una política de Supabase. Aquí se documentan los permisos que existen; reforzarlos requiere el trabajo del agente dueño de DB y sus migraciones.

## 7. Evidencia, fuentes y PDF

Antigravity verificó acceso por rol, búsqueda, estadísticas y eventos de CRUD; su reverificación confirmó la búsqueda con guion bajo y el alta de armazones. Claude corrigió además el borrador del buscador y reportó 346 tests/build limpio. Codex contrastó la documentación con el código publicado. Las cifras de filas del reporte son fotografías de la prueba, no constantes de la lección.

Fuentes Angular: `features/audit-logs/`, `AuditLogRepository`, implementación Supabase y `20261104150000_auditoria_retencion.sql`; registro de aplicación en `docs/db-changes.md` #17. Flutter: [AuditLogsView](https://github.com/MeloGon/oftal_web/blob/7d3fa5f/lib/features/settings/views/audit_logs/audit_logs_view.dart) y [Notifier/estado](https://github.com/MeloGon/oftal_web/blob/7d3fa5f/lib/features/settings/viewmodels/audit_logs_provider.dart).

```bash
npm run pdf -- docs/lessons/15-auditoria.md
```

Salida: `docs/informes/15-auditoria.pdf`, ignorada por git y regenerable desde este Markdown.
