# Registro de diseño

## Historial de pedidos

| Pedido | Fecha | Resultado (enlace Claude Design) | Resumen de decisiones |
|---|---|---|---|
| D-001 Sistema base | 2026-10-14 | [Optinova Design System](https://claude.ai/artifact/RLUAPCuqwY8nM42UqBQnD4) | v1 entregado: tokens T-01..T-07 (tipografía Geist), C-01..C-24, P-01..P-06, S-01..S-06. Incluye `export/optinova-theme.css` (Tailwind v4 `@theme`, oscuro con `data-theme`, densidad con `data-density`) y `export/primary-scale.ts` (escala 50–950 en OKLCH desde un color). Traídos al repo en E1.5a (2026-10-14) |

## Inventario de IDs

Estado: `pedido` (aún no diseñado) · `v1`, `v2`... (versión aprobada) · `implementado vN` (ya en Angular).

### Tokens
| ID | Nombre | Estado | Pedido |
|---|---|---|---|
| T-01 | Color (primario personalizable, neutros, semánticos) | implementado v1 | D-001 |
| T-02 | Tipografía | implementado v1 | D-001 |
| T-03 | Espaciado y layout | implementado v1 | D-001 |
| T-04 | Radios y bordes | implementado v1 | D-001 |
| T-05 | Sombras y elevación | implementado v1 | D-001 |
| T-06 | Movimiento (duraciones, easing) | implementado v1 | D-001 |
| T-07 | Modo oscuro | implementado v1 | D-001 |

### Componentes
| ID | Nombre | Estado | Pedido |
|---|---|---|---|
| C-01 | Button | v1 | D-001 |
| C-02 | Input de texto / número / moneda | v1 | D-001 |
| C-03 | Select / Combobox con búsqueda | v1 | D-001 |
| C-04 | Date picker | implementado v1 (2026-10-30, `shared/ui/date-picker`) | D-001 |
| C-05 | Checkbox, Radio, Switch | v1 | D-001 |
| C-06 | Segmented control / Toggle group | v1 | D-001 |
| C-07 | Table (densa) | v1 | D-001 |
| C-08 | Paginador | v1 | D-001 |
| C-09 | Card | v1 | D-001 |
| C-10 | Stat card (KPI) | v1 | D-001 |
| C-11 | Badge / Pill de estado | v1 | D-001 |
| C-12 | Dialog / Modal | v1 | D-001 |
| C-13 | Toast | v1 | D-001 |
| C-14 | Tabs | implementado v1 (2026-11-02, `shared/ui/tabs/`, `e6d7a6c` + `e019946`; flechas/Home/End y paneles enlazados) | D-001 |
| C-15 | Dropdown menu | v1 | D-001 |
| C-16 | Tooltip | v1 | D-001 |
| C-17 | Spinner / Skeleton | v1 | D-001 |
| C-18 | Empty state | v1 | D-001 |
| C-19 | Avatar | implementado v1 (2026-10-27, iniciales en Buscar paciente) | D-001 |
| C-20 | Sidebar de navegación | implementado v1 | D-001 |
| C-21 | Navbar / Topbar | implementado v1 | D-001 |
| C-22 | Stepper | implementado v1 (2026-11-01, `shared/ui/stepper`, `59fa465`) | D-001 |
| C-23 | Gráficas (barras, dona) | v1 | D-001 |
| C-24 | Selector de color primario | v1 | D-001 |

### Patrones
| ID | Nombre | Estado | Pedido |
|---|---|---|---|
| P-01 | Formulario con validación | v1 | D-001 |
| P-02 | Barra de búsqueda + filtros | v1 | D-001 |
| P-03 | Lista/tabla con acciones por fila | v1 | D-001 |
| P-04 | Diálogo de autorización (supervisor) | v1 | D-001 |
| P-05 | Tabla de graduación OD/OI | implementado v1 (2026-10-27, `shared/ui/rx-table`) | D-001 |
| P-06 | Resumen de cobro | v1 | D-001 |

### Pantallas de ejemplo
| ID | Nombre | Estado | Pedido |
|---|---|---|---|
| S-01 | Login | v1 | D-001 |
| S-02 | Dashboard | v1 | D-001 |
| S-03 | Buscar paciente + ficha con revisiones | implementado en `e6d7a6c` (2026-11-02): ruta propia, encabezado y Revisiones/Ventas/Pagos | D-001 |
| S-04 | Nueva venta (3 pasos) | implementado en `59fa465` (recibo PDF y P-04 completo pendientes) | D-001 |
| S-05 | Historial de ventas + registrar pago | v1 | D-001 |
| S-06 | Configuración / Apariencia | v1 | D-001 |

## Implementación de E2.3b (2026-10-27)

P-05 se usa en Ver/Agregar/Editar medidas: signo tipográfico, OD relleno/OI delineado, atajo de centésimas en ESF/CIL, botones ±0.25/±1 y copia OD → OI. ADD y DIP permanecen aparte como valores únicos de cada revisión. C-19 agrega iniciales a la tabla de pacientes y P-03 deja Editar como ícono visible por fila. Detalle didáctico y diferencias frente a Flutter: [L08](../lessons/08-revisiones-medidas.md).

Al cierre de E2.3b (2026-10-27), S-03 se difirió hasta que existieran Ventas/Pagos; P-05 se usaba en diálogos y no completaba ese alcance. Este pendiente se resolvió después en `e6d7a6c` (2026-11-02), con una página propia, según se explica abajo.

## Implementación de S-03 y C-14 (2026-11-02)

`e6d7a6c`, commit local en `development`: ficha en `/dashboard/search-patient/:id`, encabezado y pestañas Revisiones/Ventas/Pagos con contadores. Decisión del dueño: página propia en lugar de panel partido; sección en `?tab=`. C-14 recibe selección y emite cambios; la página monta el contenido. Se reutilizan P-05, diálogos de revisión y venta/abono, y acciones de ciclo de vida extraídas. Los dos arreglos tras Antigravity están incluidos: Restaurar sustituye a Eliminar para archivados (admin+; Editar permanece) y Revisiones usa el mismo empty-state con tarjeta que Ventas/Pagos. `e019946` completa flechas cíclicas/Home/End, foco con `viewChildren` y vínculo de paneles mediante `tabId`/`tabPanelId`. También reemplaza la consulta de pagos en dos pasos por embed sobre la FK existente. Lectura y límites: [L12](../lessons/12-ficha-paciente.md). Sin equivalente de pantalla en Flutter `7d3fa5f`.

## Implementación de E2.5 y C-04 (2026-10-30)

S-05 Historial de ventas implementado siguiendo el diseño: un buscador, segmented de estado con contadores (se le agregó esa capacidad a C-06), tabla C-07, diálogo de detalle y "Registrar pago" con método como botones con ícono. Pedido del dueño al probar: el `<input type="date">` nativo no tiene forma de volver a "hoy" (el calendario lo dibuja el navegador, no se puede tocar). Se construyó **C-04 Date picker** (`shared/ui/date-picker`): input enmascarado `dd/mm/aaaa` + calendario propio con `CdkConnectedOverlay` (grid ARIA, Limpiar/Hoy, min/maxDate), reemplazando el input nativo en los 6 lugares donde se usaba (fecha de nacimiento y de registro en pacientes, fecha de revisión, fecha de egreso, fecha de pago y el filtro de Historial de ventas). Sin la variante de rango (ningún filtro de la app la necesita todavía) y sin navegación por teclado día a día en la grilla (mejora pendiente). Value accessor propio: no usa el provider `NG_VALUE_ACCESSOR` + auto-inyección de `NgControl` (causa NG0200, dependencia circular); se asigna `ngControl.valueAccessor = this` a mano, como recomienda Angular para controles de formulario a medida.
