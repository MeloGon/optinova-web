# Transform #32: organizaciones y sucursales como datos (multi-empresa, paso 1)

Migración: `supabase/migrations/20261110140000_organizaciones_y_sucursales.sql`. Corre después de la #31.
Diseño aprobado por el dueño el 2026-11-09.

## Modelo

```
Optinova (el producto)
 └─ Organización: Inversiones Oftalvision
      ├─ OFTALVISION        (activa)
      ├─ MEDILENT           (activa)
      └─ OFTALMIC CENTER    (cerrada, con historial)
```

`megadmin` = el dueño de la plataforma, ve todas las empresas. `admin` = el de una empresa: ve y administra solo
su empresa y sus sucursales. Supervisor y vendedor pertenecen a una sucursal.

## Qué hace (paso 1, aditivo)

- Tablas `organizaciones` y `sucursales` (cada una con su organización), con una sola empresa y 3 sucursales.
- `organizacion_id` (NOT NULL, FK, índice) en `pacientes`, `revisiones`, `ventas`, `egresos`, `armazones`, `perfiles`,
  `pagos`, `resinas`, `vendedores`, `categorias_egresos`. Por DEFAULT es Inversiones Oftalvision mientras haya una sola empresa.
- `sucursal_id` (FK, índice) en `pacientes`, `revisiones`, `ventas`, `egresos`, `armazones`, `perfiles`, llenado desde el texto.
- El texto `sucursal` **se queda**: la app actual y Flutter siguen funcionando. El trigger `trg_sync_sucursal_id` completa
  `sucursal_id` cuando solo se escribe el texto.
- Lectura de `organizaciones` y `sucursales` por RLS: cada usuario ve las de su organización, `megadmin` ve todas. Sin escritura directa.
- El relleno apaga los triggers de usuario de cada tabla mientras corre (no toca `updated_at` ni auditoría).

## Resultado en DEV (2026-11-09)

| Dato | Valor |
|---|---|
| Organizaciones / sucursales | 1 / 3 |
| `sucursal_id` en pacientes, ventas, perfiles | 0 sin llenar |
| Revisiones sin sucursal | 1 344 (1 343 null + 1 vacía): no se inventa |
| Egresos / armazones sin sucursal | 8 / 329 |

Probada en transacción revertida (cifras, doble ejecución, trigger con insert, cambio de texto y texto vacío, RLS con
`megadmin` y supervisor). Advisors sin hallazgos nuevos.

## Qué falta (paso 2, aparte)

- Las RPC (`dashboard_summary`, `payments_report`, `create_sale`, `register_payment`, ventas por vendedor, permisos de equipo,
  descuentos) leen `sucursal_id` y `organizacion_id` en vez del texto.
- `organizacion_id` sale de la organización del usuario con sesión (hoy es un DEFAULT fijo, válido solo con una empresa).
- RLS por organización en las tablas del negocio (hoy `USING (true)` para autenticados).
- Pantalla de sucursales para el admin (crear, editar, desactivar) y `ConfigService` leyendo de la base.
- `sucursal_config`, `app_config`, `audit_logs` y `descuento_autorizaciones` pasan a ser por organización.
- Quitar el texto `sucursal` al final.
