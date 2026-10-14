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
| C-04 | Date picker | v1 | D-001 |
| C-05 | Checkbox, Radio, Switch | v1 | D-001 |
| C-06 | Segmented control / Toggle group | v1 | D-001 |
| C-07 | Table (densa) | v1 | D-001 |
| C-08 | Paginador | v1 | D-001 |
| C-09 | Card | v1 | D-001 |
| C-10 | Stat card (KPI) | v1 | D-001 |
| C-11 | Badge / Pill de estado | v1 | D-001 |
| C-12 | Dialog / Modal | v1 | D-001 |
| C-13 | Toast | v1 | D-001 |
| C-14 | Tabs | v1 | D-001 |
| C-15 | Dropdown menu | v1 | D-001 |
| C-16 | Tooltip | v1 | D-001 |
| C-17 | Spinner / Skeleton | v1 | D-001 |
| C-18 | Empty state | v1 | D-001 |
| C-19 | Avatar | v1 | D-001 |
| C-20 | Sidebar de navegación | implementado v1 | D-001 |
| C-21 | Navbar / Topbar | implementado v1 | D-001 |
| C-22 | Stepper | v1 | D-001 |
| C-23 | Gráficas (barras, dona) | v1 | D-001 |
| C-24 | Selector de color primario | v1 | D-001 |

### Patrones
| ID | Nombre | Estado | Pedido |
|---|---|---|---|
| P-01 | Formulario con validación | v1 | D-001 |
| P-02 | Barra de búsqueda + filtros | v1 | D-001 |
| P-03 | Lista/tabla con acciones por fila | v1 | D-001 |
| P-04 | Diálogo de autorización (supervisor) | v1 | D-001 |
| P-05 | Tabla de graduación OD/OI | v1 | D-001 |
| P-06 | Resumen de cobro | v1 | D-001 |

### Pantallas de ejemplo
| ID | Nombre | Estado | Pedido |
|---|---|---|---|
| S-01 | Login | v1 | D-001 |
| S-02 | Dashboard | v1 | D-001 |
| S-03 | Buscar paciente + ficha con revisiones | v1 | D-001 |
| S-04 | Nueva venta (3 pasos) | v1 | D-001 |
| S-05 | Historial de ventas + registrar pago | v1 | D-001 |
| S-06 | Configuración / Apariencia | v1 | D-001 |
