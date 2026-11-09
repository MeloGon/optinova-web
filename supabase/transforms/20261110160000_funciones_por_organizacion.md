# Transform #34: auditoría, configuración y RPC por organización (multi-empresa, paso 2b)

Migración: `supabase/migrations/20261110160000_funciones_por_organizacion.sql`. Corre después de la #33.

## Qué hace

- `audit_logs`: `organizacion_id` (llenado con Oftalvision en las 2 929 filas existentes), trigger que lo completa con la organización
  del usuario con sesión y política única por organización (lectura e inserción).
- `app_config`: llave primaria pasa a `(organizacion_id, key)`; cada empresa tiene sus interruptores. Solo `admin`/`megadmin` de esa
  organización los cambian.
- `sucursal_config`: llave primaria `(organizacion_id, sucursal)`; lectura limitada a la propia organización.
- Pasan a `SECURITY INVOKER` (la RLS decide qué ven, sin cambiar su lógica): `dashboard_summary`, `dashboard_activity`,
  `sales_by_seller_summary`, `sales_by_seller_detail`, `audit_logs_stats`.
- Siguen con permisos de sistema pero filtran por organización: `payments_report`, `list_team_vendors`,
  `set_vendor_change_date_permission` (no puede tocar usuarios de otra empresa), `set_branch_discount_auth` (la sucursal debe existir
  en la organización de quien la cambia) y el trigger `enforce_venta_descuento` (lee solo la configuración de la organización de la venta).
- `megadmin` ve todas las empresas en los reportes y la auditoría. En `app_config` y `sucursal_config` actúa sobre la de su propia empresa.

## Prueba (DEV 2026-11-09, transacción revertida)

- Salidas de las 7 funciones para admin, megadmin y supervisor **idénticas antes y después**; los únicos errores son rechazos de permiso del
  supervisor, iguales en ambos lados.
- Segunda empresa "Otra Optica" con admin y vendedor: ve 0 en auditoría, configuración, dashboard, pagos, egresos y ventas por vendedor;
  su lista de equipo solo trae a su vendedor; no puede otorgar permisos a un supervisor de Oftalvision ni cambiar descuentos en una
  sucursal ajena; sí en la suya. El supervisor de Oftalvision no ve su auditoría. `megadmin` sí.

## Pendiente

- Una empresa nueva nace sin filas de `app_config`: el alta de empresa (paso 2d) debe sembrarlas.
- Filas de `audit_logs` escritas por Edge Functions (service role) quedan con `organizacion_id` nulo y solo las ve `megadmin`: se
  corrige en el paso 2c pasando la organización.
- `perfiles` y las Edge Functions (2c).
