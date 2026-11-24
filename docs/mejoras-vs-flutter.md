# Mejoras y cambios de Angular frente a Flutter

Registro de los principales cambios que la app Angular (`optinova-web`) hace distinto o mejor que la app Flutter (`oftal_web`, commit `7d3fa5f`), y de lo que cambió en la base de datos `optinova-db`.

- Fecha de corte de este registro: 2026-11-23 (migraciones #1 a #37).
- Fuentes: `docs/db-changes.md` (detalle técnico de cada migración), la matriz de paridad de `docs/migration-plan.md` (Fase 3) y `docs/status.md`.
- Para aplicar estos cambios en Flutter, ver `docs/guia-flutter-sobre-optinova-db.md`.

## 1. Resumen en una página

| Tema | En Flutter | En Angular / optinova-db |
|---|---|---|
| Seguridad de acceso | Nueve políticas permitían acceso sin sesión; una política permitía escalar el rol | Se cerraron esas políticas a usuarios sin sesión y se restringió la edición del rol (#1, #2, también aplicados en PROD) |
| Ventas | Encabezado y líneas se guardaban en varias llamadas sueltas; si una fallaba quedaban ventas sin líneas o líneas sin venta | Una sola transacción en el servidor (`create_sale`, #26): o se guarda todo o nada |
| Abonos | El saldo se actualizaba desde el navegador | `register_payment` (#26) bloquea la venta, valida que el abono no pase el saldo y actualiza en una transacción |
| Folios e IDs | El navegador los inventaba; había folios repetidos | Los genera la base con secuencias (#5, #7, #10, #18, #29) |
| Stock | Restaba una unidad por llamada, sin validar | Resta la cantidad real, valida stock suficiente y nunca baja de 0 (#26) |
| Pacientes | Borrado directo, sin mirar historial ni rol | Archivar o borrar según historial, con autorización (#11) |
| Ficha del paciente | No existía | Cabecera con pestañas de revisiones, ventas y pagos |
| Reportes | El alcance por sucursal se filtraba solo en el navegador | Lo decide el servidor según el rol (#12, #19, #23) |
| Descuentos | Sin control | Regla por sucursal: el vendedor puede necesitar autorización del supervisor (#24) |
| Multi-empresa | Una sola óptica, sucursales escritas en el código | Empresas y sucursales como datos, con aislamiento por empresa (#32 a #36) |
| Datos históricos | Duplicados, fichas vacías, ventas sin paciente | Fichas duplicadas unidas, vacías archivadas, 1 663 ventas reenlazadas (#27, #28, #30, #31) |

## 2. Seguridad

1. **Se cerraron nueve políticas abiertas a `anon`** (#1). Nueve reglas de la base estaban abiertas a cualquiera, incluso sin sesión. Se aplicó también en PROD con autorización del dueño.
2. **Se restringió la autoedición del rol** (#2). Una regla permitía a cualquier usuario editar su propio perfil, incluido su `rol`. Un vendedor podía hacerse megadmin. Corregido en DEV y en PROD.
3. **Borrar pacientes solo en el servidor** (#11). Antes el navegador podía borrar cualquier paciente. Ahora lo decide la Edge Function `patients-lifecycle` según el historial:
   - sin historial se borra;
   - con medidas, el vendedor necesita la autorización de un supervisor;
   - con ventas, se archiva (solo admin o superior) y se puede restaurar.
4. **Configuración solo para admin** (#21). Cualquier usuario, incluso un vendedor, podía encender o apagar funciones de la app llamando directo a la API.
5. **Reportes con alcance en el servidor** (#12, #19, #23). El Dashboard, Ingresos y egresos y Ventas por vendedor deciden qué puede ver cada rol en la base. En Dashboard y Reporte de pagos el supervisor queda limitado a su sucursal; Ventas por vendedor exige admin o superior.
6. **Revisión con los advisors de Supabase** (#25). Se cerraron funciones expuestas, se fijó el `search_path` y se agregaron índices faltantes.
7. **Aislamiento por empresa** (#33 a #35). Cada usuario ve y escribe solo los datos de su empresa; megadmin ve todas. Probado por Antigravity con una segunda empresa.

## 3. Ventas, pagos y stock

1. **Ventas atómicas** (#26). Flutter guardaba primero las líneas, después el encabezado, después restaba stock y después el pago, cada paso por separado. Si algo fallaba a mitad, quedaba basura. En la huella de noviembre había 191 líneas sin venta; el ensayo del 23 de noviembre registró 197. La investigación identificó un error de `deleteSale` y escrituras no atómicas como causas posibles. Ahora `create_sale` hace todo en una transacción y recalcula el total desde las líneas en el servidor.
2. **Una venta no puede quedar sin líneas.** Un trigger lo impide (#26). Las 257 históricas sin líneas se conservan como estaban.
3. **Abonos seguros** (#26). `register_payment` impide abonar más que el saldo y evita que dos abonos simultáneos pisen el saldo.
4. **Stock real** (#26). Flutter restaba una unidad por llamada, sin importar la cantidad vendida. Ahora se resta la cantidad, se valida que alcance y `existencias` nunca es negativo.
5. **Folios sin choques** (#10). En PROD 17 872 folios distintos cubrían 24 827 ventas. En el ensayo del 23 de noviembre el siguiente folio era 997 834; la secuencia se inicializa con los datos de la copia, por lo que ese valor puede cambiar en el corte.
6. **Productos vendidos no se pierden** (#26). Borrar un armazón o una resina que ya se vendió lo archiva en vez de borrarlo, y el historial de ventas sigue mostrándolo.
7. **Quién registró la venta** (#12). `ventas.creado_por` guarda el usuario con sesión, distinto del vendedor a cuyo nombre queda. El navegador no lo puede falsear.
8. **Autorización de descuentos por sucursal** (#24, P-04). El supervisor decide si en su sucursal los vendedores necesitan su correo y contraseña para dar descuento. La regla se hace cumplir en el servidor. Viene apagada.
9. **Permiso de cambiar fecha de venta** (#22). Ya no es un interruptor único: el supervisor lo da por vendedor de su sucursal. El interruptor general queda como apagado de emergencia.

## 4. Pacientes y revisiones

1. **Fechas reales** (#3). Fecha de registro y de nacimiento pasan de texto (en 3 formatos distintos) a fecha.
2. **Género normalizado** (#4). `H`, `M`, `Masculino`, `Femenino` y vacíos pasan a `Masculino`, `Femenino`, `Otro` o vacío.
3. **IDs sin riesgo** (#5, #7). Antes el navegador inventaba IDs de 16 a 17 dígitos. 112 pacientes superaban el límite que JavaScript guarda exacto. Ahora los genera la base.
4. **Teléfonos visibles** (#6). 4 954 pacientes tenían número solo en `TELEFONO 1`, que Flutter nunca mostraba. Ahora existen `telefono` y `telefono_secundario`; ver el mapeo y las reglas de migración en #6.
5. **Revisiones enlazadas al paciente** (#7, #27). Antes se unían solo por nombre. Ahora tienen `paciente_id`. Se enlazaron también 168 revisiones con nombre repetido gracias a una venta cercana.
6. **Ventas enlazadas al paciente** (#28). El registro #28 documenta que desde septiembre de 2025 Flutter dejó de guardar el id del paciente en algunas ventas; esas ventas no podían vincularse por ese id. Se reenlazaron 1 663.
7. **Fichas duplicadas unidas** (#30). 34 fichas con mismo nombre, teléfono y nacimiento se unieron, con respaldo para deshacer.
8. **Fichas vacías archivadas** (#31). Se archivaron 139 fichas sin nombre y sin historial.
9. **Pacientes de prueba archivados** (#37). Los 24 de PROD siguen en el historial, pero no salen en las búsquedas.
10. **Ficha del paciente** (pantalla nueva). Cabecera con sus datos y pestañas de revisiones, ventas y pagos.

## 5. Pantallas (paridad con Flutter)

| Pantalla | Veredicto |
|---|---|
| Login | Igual: sesión y acceso por rol |
| Buscar paciente | Igual, con búsqueda y página guardadas en la URL |
| Eliminar o archivar paciente | Mejora: decide según el historial, con autorización |
| Ficha del paciente | Nueva: Flutter no la tiene |
| Egresos | Igual en el flujo principal; sin filtro por vendedor |
| Historial de ventas | Igual en el flujo principal; sin CSV ni rango de fechas |
| Vender | Mejora: descuento con autorización por sucursal, stock por cantidad, venta atómica |
| Dashboard | Mejora: alcance por rol en el servidor, periodos (hoy, semana, mes), cobranza, stock bajo, productos y vendedores top |
| Resinas y Armazones | Igual, con tablas, filtros y código de barras editable; archivar si ya se vendió |
| Auditoría | Mejora: tabla, búsqueda y retención de 3 meses (#17) |
| Ventas por vendedor | Simplificado (sin PDF ni selector individual), pero calculado en el servidor y paginado |
| Reporte de pagos | Igual, con alcance en el servidor; sin CSV |
| Usuarios | Mejora: crear, editar y activar o desactivar, además de listar y restablecer contraseña |
| Features | Mejora: interruptor general y permisos por vendedor y sucursal |
| Sucursales | Nueva: crear, renombrar, cerrar o reabrir sucursales y crear empresas (megadmin) |

Pendientes frente a Flutter: PDF de Ventas por vendedor y filtro por vendedor en Egresos. Ninguna de las dos apps implementa CSV de Historial o Reporte de pagos en el código consultado; la exportación de Flutter está comentada.

## 6. Multi-empresa

1. **Empresas y sucursales como datos** (#32). La empresa actual es "Inversiones Oftalvision", con OFTALVISION, MEDILENT y OFTALMIC CENTER (cerrada). Nada de sucursales escritas en el código.
2. **Aislamiento** (#33 a #35). Cada tabla del negocio sabe a qué empresa pertenece y la base solo deja ver la propia.
3. **Administración** (#36). El admin crea, renombra, cierra y reabre las sucursales de su empresa. Nunca puede cerrar la última abierta. El megadmin crea empresas nuevas con su sucursal y su administrador en un solo paso.
4. **La app lee las sucursales de la base.** Los formularios de alta ofrecen sucursales abiertas; los filtros permiten incluir cerradas. Al editar un egreso se conserva su sucursal histórica.

## 7. Rendimiento y consumo

1. **Ventas por vendedor sin traer el mes completo** (#23). Antes se descargaban al navegador todas las ventas del mes para sumarlas. Ahora la base devuelve el resultado ya armado y pagina de verdad.
2. **Índices** (#12, #25). Fechas, sucursal, `creado_por` y llaves foráneas como `venta_items.venta_id`, que se consulta en cada detalle de venta.
3. **Auditoría con retención** (#17). Se borran solos los registros de más de 3 meses, el día 1 de cada mes.

## 8. Lo que queda pendiente

Revisión manual de ~100 grupos de fichas y del número de ventas ambiguas (114 o 116); 28 ventas sin ficha. Revisar escrituras directas por RLS (#35 eliminó `admin all perfiles`), moneda, métodos de pago y zona horaria por empresa. El dueño debe activar la protección de contraseñas filtradas en Supabase.
