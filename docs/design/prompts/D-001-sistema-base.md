# D-001: Sistema de diseño base de Optinova

> Pedido para Claude Design. Copia todo lo que está debajo de la línea.
> IDs afectados: T-01..T-07, C-01..C-24, P-01..P-06, S-01..S-06 (ver `../design-log.md`).

---

Necesito un **sistema de diseño** (no un diseño final) para **Optinova**, un sistema web de gestión para ópticas. Será la base para construir los componentes de la app, así que prioriza **consistencia, tokens claros y estados de cada componente** por encima de pantallas perfectas.

## 1. Contexto del producto

- **Qué es:** sistema interno de una cadena de ópticas en **Perú**, con varias sucursales (hoy: OFTALVISION, MEDILENT, OFTALMIC CENTER). Moneda **S/.** (soles). Métodos de pago: efectivo, tarjeta, transferencia, **Yape**, nómina, otro.
- **Quién lo usa:** personal de mostrador en computadora de escritorio, muchas horas al día:
  - **Vendedor:** busca pacientes, registra revisiones de la vista y hace ventas.
  - **Supervisor:** además autoriza operaciones sensibles.
  - **Admin / Megadmin:** reportes, inventario, usuarios y configuración.
- **Qué hacen:** registrar pacientes, guardar su graduación (revisiones), vender lentes (resinas/micas + armazones/monturas), cobrar en abonos (ventas con saldo pendiente), registrar egresos y ver reportes.
- **Estética actual:** la app existente usa estilo **shadcn/ui** (limpio, neutro, bordes sutiles, radios medianos). Quiero algo en esa línea, **más pulido y con más personalidad**, sin perder sobriedad: es una herramienta de trabajo, no una landing page.
- **Aún no hay logo.** Usa un placeholder de texto "Optinova" y deja previsto el espacio para el logo.

## 2. Requisitos clave

1. **Color primario 100 % personalizable por el usuario.** El usuario elige un color (selector + presets) y toda la app se adapta. Por eso:
   - Define el primario como una **escala completa (50–950) generada a partir de un solo color base**, y explica la regla para generarla (por ejemplo en OKLCH: mismo tono, luminosidad escalonada).
   - Cada componente debe usar **tokens semánticos** (`primary`, `primary-foreground`, `ring`...), nunca colores fijos.
   - Garantiza **contraste AA** del texto sobre el primario en cualquier color elegido (indica cómo elegir automáticamente texto claro u oscuro).
   - Propón **6–8 presets** (por ejemplo: azul óptico, verde menta, violeta, coral, ámbar, grafito).
2. **Modo claro y modo oscuro**, ambos de primera clase. Todos los tokens deben tener los dos valores.
3. **Alta densidad de datos:** tablas con muchas filas, montos y fechas. Necesito al menos **dos densidades** (cómoda y compacta) para tablas y formularios.
4. **Escritorio primero** (1280–1920 px), usable en tablet (≥768 px).
5. **Accesibilidad:** foco visible en todo, contraste AA, estados que no dependan solo del color.
6. **Implementación prevista:** Angular + **Tailwind CSS v4** (tokens como variables CSS en `@theme`) + componentes headless de Angular CDK/Aria. Nombra los tokens de forma que se traduzcan directo a variables CSS (`--color-primary-500`, `--radius-md`, etc.).

## 3. Entregables

### Tokens (con valores para claro y oscuro)
- **T-01 Color:** escala primaria generada, neutros/superficies (fondo, card, borde, muted), semánticos (success, warning, danger, info) y colores para gráficas (5–6 series que combinen con cualquier primario).
- **T-02 Tipografía:** familia (Google Font gratuita), escala de tamaños y pesos, y **cifras tabulares** para montos y graduaciones.
- **T-03 Espaciado y layout:** escala, grid, anchos de sidebar (expandida y colapsada) y alturas de topbar.
- **T-04 Radios y bordes.**
- **T-05 Sombras y elevación.**
- **T-06 Movimiento:** duraciones y easing.
- **T-07 Modo oscuro:** cómo se mapean los tokens.

### Componentes (muestra todos sus estados: normal, hover, foco, activo, deshabilitado, cargando, error si aplica)
- **C-01 Button:** primario, secundario, outline, ghost, peligro, solo ícono; tamaños sm/md/lg.
- **C-02 Input:** texto, número, **moneda (S/.)**, con ícono, con ayuda y con error.
- **C-03 Select / Combobox con búsqueda.**
- **C-04 Date picker** (formato dd/mm/aaaa, en español).
- **C-05 Checkbox, Radio, Switch.**
- **C-06 Segmented control / Toggle group** (por ejemplo, elegir Resina / Armazón / Otros).
- **C-07 Table densa:** cabecera fija, orden por columna, fila seleccionada, acciones por fila, columnas numéricas alineadas a la derecha, fila de totales.
- **C-08 Paginador.**
- **C-09 Card.**
- **C-10 Stat card (KPI):** valor, etiqueta, variación y mini-gráfica opcional.
- **C-11 Badge / Pill de estado:** Pagado, Con saldo, Pendiente, Anulado; roles (Vendedor, Supervisor, Admin); sucursal.
- **C-12 Dialog / Modal:** normal, de confirmación destructiva y con formulario.
- **C-13 Toast:** éxito, error, aviso, info.
- **C-14 Tabs.**
- **C-15 Dropdown menu.**
- **C-16 Tooltip.**
- **C-17 Spinner y Skeleton.**
- **C-18 Empty state:** "Sin ventas recientes", "Sin resultados".
- **C-19 Avatar** (iniciales).
- **C-20 Sidebar:** secciones (Menú, Inventario, Reportes, Administración, Súper administración), ítem activo, colapsada.
- **C-21 Topbar:** título de página + descripción, selector de sucursal, usuario, cambio claro/oscuro.
- **C-22 Stepper** (para la venta en 3 pasos).
- **C-23 Gráficas:** barras (ventas 7 días) y dona (métodos de pago, egresos por categoría).
- **C-24 Selector de color primario:** presets + color libre + vista previa en vivo.

### Patrones
- **P-01 Formulario con validación** (etiquetas, ayuda, errores, botones al pie).
- **P-02 Barra de búsqueda + filtros** (texto, fecha, sucursal, toggle "solo pendientes").
- **P-03 Lista/tabla con acciones por fila** (ver, editar, eliminar, registrar pago).
- **P-04 Diálogo de autorización:** un supervisor ingresa su correo y contraseña para aprobar una acción sensible.
- **P-05 Tabla de graduación OD/OI:** filas OD (ojo derecho) y OI (ojo izquierdo); columnas ESF, CIL, EJE, AV, más ADD y DIP. Valores como `-1.25`, `+0.50`, `180`, `20/25`. Debe leerse de un vistazo.
- **P-06 Resumen de cobro:** importe bruto, descuento (con motivo), total, a cuenta (abono inicial), saldo por cobrar y método de pago.

### Pantallas de ejemplo (para validar el sistema, no son finales)
- **S-01 Login:** correo, contraseña y espacio para el logo.
- **S-02 Dashboard:**
  - saludo según la hora ("Buenos días, Ana");
  - KPIs: ingresos hoy, mis ventas hoy, clientes en sucursal, saldo por cobrar;
  - gráfica de ventas de los últimos 7 días;
  - dona de métodos de pago de hoy;
  - dona de egresos del mes por categoría;
  - ventas recientes ("Ver todas →");
  - actividad reciente (auditoría);
  - accesos rápidos (Nueva venta, Agregar paciente, Buscar paciente).
- **S-03 Buscar paciente + ficha:**
  - búsqueda por nombre y lista de resultados;
  - al elegir uno: datos del paciente y su historial de revisiones, con la tabla OD/OI (P-05);
  - acciones: agregar revisión, editar, vender.
- **S-04 Nueva venta (3 pasos con C-22):**
  1. Seleccionar paciente.
  2. Seleccionar productos: elegir categoría Resina / Armazón / Otros y buscar.
  3. Revisar y confirmar: nota de venta con productos y precio unitario editable, vendedor, sucursal, fecha, y el resumen de cobro (P-06).
- **S-05 Historial de ventas:** filtros (P-02) y tabla de ventas con estado (Pagado / Con saldo). El detalle de una venta va en un diálogo con sus productos y pagos, más un diálogo para "Registrar pago".
- **S-06 Configuración → Apariencia:** selector de color primario (C-24), modo claro/oscuro/sistema y densidad. Muestra la misma pantalla con 2–3 primarios distintos y en oscuro para probar que el sistema aguanta.

## 4. Formato de entrega y trazabilidad

- Usa **exactamente estos IDs** (T-xx, C-xx, P-xx, S-xx) como título de cada sección o frame, para poder referenciarlos en pedidos futuros.
- Marca todo como **versión v1**.
- Incluye al final una **tabla de tokens** (nombre, valor claro, valor oscuro, uso) lista para pasar a variables CSS.
- Incluye una lista breve de **decisiones de diseño** (por qué esta tipografía, por qué estos radios, etc.).
- Textos de la interfaz **en español**, con datos de ejemplo realistas pero ficticios.
