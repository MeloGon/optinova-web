# Transform #36: administrar sucursales y empresas (multi-empresa, paso 2d)

Migración: `supabase/migrations/20261110180000_administrar_sucursales_y_organizaciones.sql`. Corre después de la #35.
Decisiones del dueño (2026-11-09): se puede renombrar una sucursal aunque tenga datos; cierran sucursales `admin` y `megadmin`;
toda empresa nace con una sucursal inicial.

## Qué hace

Tres funciones `SECURITY DEFINER` (ejecutables por `authenticated`; `sucursales` y `organizaciones` siguen sin escritura directa):

| Función | Quién | Reglas |
|---|---|---|
| `crear_sucursal(nombre, organizacion?)` | `admin` (su empresa), `megadmin` (cualquiera) | Nombre en mayúsculas, sin espacios repetidos, 1 a 60 caracteres, único por empresa. |
| `editar_sucursal(id, nombre?, activa?)` | Igual | Cerrar = `activa = false` (no borra). No se puede cerrar la última abierta. Una sucursal ajena responde "no encontrada". |
| `crear_organizacion(nombre, sucursal)` | Solo `megadmin` | Crea la empresa, su primera sucursal y su `app_config` inicial (`feature_change_date`). Nombre único sin importar mayúsculas. |

Todas dejan fila en `audit_logs` con la organización (`create_branch`, `update_branch`, `create_organization`).

## Renombrar

Actualiza el texto `sucursal` de `pacientes`, `revisiones`, `ventas`, `egresos`, `armazones`, `perfiles` y `sucursal_config`
de esa empresa. En `pacientes`, `revisiones` y `ventas` apaga los triggers de usuario durante el cambio (no mueve `updated_at`,
no audita 25 000 ventas, no dispara reglas de descuento) y los vuelve a encender en la misma transacción. Toma un candado breve
sobre esas tablas: conviene renombrar fuera de horas de venta. El nombre anterior queda en la auditoría
(`detail.nombre_anterior`). Las filas viejas de auditoría que mencionan el nombre antiguo no se tocan.

## No hace

Crear el usuario admin de la empresa nueva: eso lo hace la Edge Function `megadmin-users` (acción `create_organization`, siguiente paso).
Moneda y métodos de pago por empresa siguen fijos.

## Prueba (transacción revertida, DEV 2026-11-09)

- Supervisor no puede crear. Admin crea (`"  sucursal   nueva "` queda `SUCURSAL NUEVA`); duplicada, vacía y de 61 caracteres se rechazan.
- Un admin no crea ni edita en otra empresa. Megadmin crea en cualquiera.
- Cerrar la última sucursal abierta se rechaza; con otra abierta, se permite; reabrir funciona.
- Renombrar MEDILENT: 6 888 ventas, 5 360 pacientes, 4 412 revisiones y 2 perfiles pasan al nombre nuevo (mismos conteos que antes),
  `sucursal_id` coherente, `updated_at` de pacientes intacto, 0 filas de auditoría de ventas nuevas, triggers de nuevo activos.
- `crear_organizacion`: solo megadmin; deja 1 sucursal y su configuración; rechaza nombre repetido y sucursal vacía.
