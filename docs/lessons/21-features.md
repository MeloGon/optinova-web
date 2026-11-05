# L21: Funcionalidades y permiso para cambiar fecha

**Idea central:** un interruptor global y un permiso individual responden preguntas distintas: si la función está habilitada para la empresa y si un vendedor puede verla en su flujo. La gestión de permisos tiene controles de alcance en el servidor.

Solo teoría comparada con Flutter/Riverpod, sin ejercicios. Corte Angular `98d9439` (Features y migraciones #21/#22); Flutter de referencia `7d3fa5f`. Antigravity reportó ocho casos aprobados en `docs/status.md`; esta lección no vuelve a operar sobre la base de datos.

## 1. Qué hacía Flutter y qué agregó Angular

Flutter tiene `FeaturesView`, `FeaturesToggleSection` y `AppFeaturesNotifier`. Carga `feature_change_date` desde `app_config` y muestra un interruptor global. Su notifier cambia el valor de manera optimista y lo revierte si falla el guardado. No incluye en esa pantalla una lista de permisos por vendedor.

Angular conserva el control global y añade una sección para permisos de vendedores, por decisión del dueño. El supervisor administra vendedores de su sucursal; admin y megadmin pueden administrar vendedores de todas. La ruta es `/dashboard/settings/features` y está disponible desde supervisor; la sección de interruptores generales se muestra solo a admin o superior.

| Flutter / Riverpod | Angular |
|---|---|
| `AppFeaturesNotifier` y `copyWith` | `AppFeaturesStore`, signal de estado y `computed` |
| Un flag `feature_change_date` | Flag global más permiso por vendedor |
| Cambio optimista y reversión | `toggle` / `toggleVendor`, con errores y reversión |
| Repositorio de configuración | `AppConfigRepository` y `TeamPermissionsRepository` |

## 2. Dos condiciones para la interfaz

En `SalesHistoryPage.canChangeDate`, si el flag global está apagado se oculta la acción. Si está encendido, vendedor necesita `profile.canChangeDate`; los roles superiores no necesitan ese permiso individual. Sin perfil no se habilita la acción. En forma abreviada, para una sesión con perfil:

```text
visible = flag_global && (rol != vendedor || permiso_individual)
```

El permiso del perfil se lee al iniciar sesión; para observar un cambio puede ser necesario refrescar la sesión o volver a entrar. La prueba de Antigravity registró el reingreso del vendedor tras cambiar el permiso. No se debe prometer actualización instantánea de todas las sesiones abiertas sin comprobar ese mecanismo.

El interruptor global es un apagado general; apagarlo no borra los permisos individuales. Al volver a activarlo, cada permiso guardado conserva su valor. La vista de Historial usa esa condición para ofrecer la acción y abrir el diálogo de fecha.

## 3. Estado optimista y errores

`AppFeaturesStore` tiene listas y estados de carga/error independientes para funciones y vendedores. Al accionar un switch, actualiza de inmediato el signal y marca la clave o el vendedor que se está guardando. Después consulta el repositorio. Si falla, revierte ese valor y presenta el error. Es la misma idea que el `copyWith` optimista de Flutter: la respuesta inmediata mejora la interacción, pero el servidor sigue siendo quien confirma el guardado.

`AppConfigRepository` convierte los textos de DB a booleanos en el modelo; al guardar convierte el booleano a texto. Si la política impide actualizar y devuelve cero filas, la implementación lo trata como falta de permiso aunque la API no devuelva un error explícito.

## 4. Quién puede administrar permisos

La migración #21 restringe escrituras de `app_config` a admin o superior mediante RLS. La #22 agrega `perfiles.puede_cambiar_fecha` y las funciones `list_team_vendors` y `set_vendor_change_date_permission`. Esas RPC consultan la identidad y el rol del solicitante en servidor: supervisor queda limitado a su sucursal; admin/megadmin tienen alcance general. La actualización de permiso deja un evento de auditoría. Las opciones visibles de la pantalla facilitan el uso, pero la comprobación de la RPC es la que protege esa administración frente a una llamada directa.

**Alcance de esa protección:** el control de visibilidad del cambio de fecha se calcula en la página. En el código revisado, `SupabaseSaleRepository.changeDate` hace un `UPDATE` directo a `ventas.fecha_actualizada`; las dos RPC de permisos administran el permiso, pero no envuelven esa actualización. Por eso no se debe concluir solo con esta pantalla que el flag y el permiso individual bloquean cualquier actualización directa por API: eso depende de las políticas y validaciones de ventas efectivas en servidor. Revisar esa garantía como pendiente de seguridad antes de prometerla.

## 5. Prueba y límites

Antigravity registró comprobaciones de roles, supervisor por sucursal, permiso concedido/revocado, interruptor global, cambio de fecha y auditoría. Esa evidencia describe las pruebas registradas, no una prueba nueva ejecutada al escribir esta clase. `app_config` sigue siendo una configuración general; no sustituye la futura administración completa de sucursales de Fase 4b.

Fuentes Angular: `features/app-features/`, repositorios de configuración/equipo, `sales-history.page.ts`, `supabase-sale.repository.ts` y migraciones #21/#22. Referencia Flutter: [Features en oftal_web](https://github.com/MeloGon/oftal_web/tree/7d3fa5f/lib/features/settings).
