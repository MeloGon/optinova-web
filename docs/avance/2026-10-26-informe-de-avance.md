# Informe de avance: Optinova Web

Fecha de corte: **26 de octubre de 2026**. Rama `development`, HEAD de implementación `e3ef363`. Fuentes: historial Git, código versionado, `docs/status.md`, `docs/migration-plan.md` y `docs/db-changes.md`. Se revisó desde `42a8e04` hasta HEAD y se consultaron los commits anteriores para explicar el avance total.

## 1. Dónde estamos

Optinova Web ya tiene infraestructura Angular, tema propio, sesión con roles, búsqueda de pacientes con paginación, edición, eliminación básica y formulario de alta. Todavía no reemplaza a la aplicación Flutter en producción: faltan revisiones, ventas, pagos, egresos, reportes y otras áreas.

El proyecto también es un curso para su dueño. La entrega documental incluye las lecciones 00–07, fundamentos F00–F03 y F07, este informe y un índice. F04–F06 siguen pendientes. Las lecciones anteriores se conservan sin reescribir: describen el momento de su entregable y algunas pantallas o pendientes ya evolucionaron.

## 2. Qué se hizo, por entregable

### Infraestructura y seguridad

- **Plan y estructura inicial:** `8d252a8` y `f1ddd25` (13 de octubre). Guía, glosario, esquema inicial y datos de prueba.
- **Acceso a datos solo autenticado:** `e9eec49`. Se corrigieron políticas abiertas. La corrección histórica en ambos ambientes consta en el registro de DB; este informe no aplica cambios.
- **Scaffold Angular y diseño propio:** `4d6f867`, `d68a6bb` y `dc18e3f` (14 de octubre). Angular, Tailwind, tokens, tema claro/oscuro, densidad, color primario y configuración por ambiente.
- **Core:** `7895a46`. Cliente Supabase, Result, errores, configuración y formato de moneda.
- **Layouts y rutas:** `604a9db`. Marco de autenticación, dashboard, sidebar, topbar, rutas diferidas y páginas pendientes.
- **Evitar autoasignación de rol:** `a3cda61` (23 de octubre). Corrección de la política de perfiles.

### E2.1: login, sesión y permisos

`765c39e` incorpora autenticación real, restauración, guards y roles. `3163f51` registra el resultado de la prueba manual de Antigravity: credenciales erróneas, entrada con los cuatro roles, restricciones de rutas, persistencia al recargar y cierre de sesión.

Es una validación registrada de E2.1, no una certificación de las features incorporadas después ni de toda la aplicación. La lección F07 explica el recorrido del código y está preparada localmente, pendiente de aprobación de commit.

### E2.2: buscar, editar y eliminar paciente

- `fd4a892`: página real de búsqueda, URL con q/page/size, tabla y paginación; Badge, Skeleton, EmptyState, Paginator y Table.
- `f78967d`: eliminación con confirmación, actualización de la lista y toasts.
- `5135adf`: editor con formulario, normalización de género y controles Field/Input reutilizables.
- `93b30a4` y `e3ef363`: adaptación posterior a IDs como texto, columnas limpias y teléfono secundario.

La implementación básica de E2.2 tiene commits. Ver y agregar medidas aún aparecen como acciones futuras. La decisión de eliminar o archivar según historial exige otro entregable: el borrado actual no ejecuta esa política completa.

### E2.3a: registrar un paciente

`ef10044` incorpora Reactive Forms, validadores, sucursal según rol, control Segmented, aviso de nombre repetido, vista previa y cinco pacientes recientes. `e3ef363` agrega el teléfono secundario y adapta la persistencia.

El formulario de pacientes está implementado. **E2.3 completo sigue abierto** porque falta E2.3b, las revisiones. La fila de Claude en status todavía describe como pendiente de commit la migración #6; Git confirma que ya está en `e3ef363`. Este informe usa el commit para resolver esa discrepancia sin atribuir una nueva prueba manual al dueño.

### Base de datos de pacientes

- `a7e6ae3`, cambio #3: fechas tipo date y created_at/updated_at.
- `5135adf`, cambio #4: género normalizado y CHECK.
- `93b30a4`, cambio #5: secuencia para IDs nuevos y transporte como texto.
- `e3ef363`, cambio #6: nombres de columnas limpios y recuperación/consolidación de teléfonos.

Hay **siete archivos de migración**, contando el baseline y los cambios #1–#6, y **cuatro documentos de transform**, #3–#6. La nota antigua de status «transforms aún no existe» ya no coincide con el repositorio. Las conversiones ejecutables están dentro de las migraciones; los Markdown explican reglas y comprobaciones.

### Curso y herramientas documentales

- `8b30961`: Fase 0 y F01.
- `42a8e04`: generador Markdown a PDF con pdfmake, marked y Geist.
- `eb7c209`: roles de agentes y tablero compartido.
- `fd148b5`: F00, F02, F03 y sincronización del plan.
- Entrega actual, **sin commit**: F07 local conservada; nuevas L05, L06 y L07; glosario e índice de lecciones ampliados; informe, regeneración completa de PDF, índice de entrega y ZIP.

## 3. Qué falta, por fase

Los checkboxes distinguen lo implementado de lo pendiente. No significan que todo el sistema haya pasado una prueba integral. El plan base todavía tenía E2.2 sin marcar y la pausa de features; se consolida con los commits y la decisión del dueño de retomar el desarrollo.

### Fase 0: aprendizaje

- [x] F00: ecosistema web.
- [x] F01: TypeScript, primera parte.
- [x] F02: objetos y organización de TypeScript.
- [x] F03: HTML y árbol de etiquetas.
- [ ] F04: CSS, Tailwind y responsive.
- [ ] F05: componentes, signals y plantillas.
- [ ] F06: servicios e inyección.
- [ ] F07: preparada con PDF; falta revisión y aprobación de commit.

El dueño decidió continuar con features sin esperar F04–F06. El aprendizaje sigue en paralelo.

### Fase 1: infraestructura

- [x] E1.1: herramientas.
- [x] E1.2 y E1.2b: estructura inicial y seed.
- [x] E1.3: scaffold y ambientes.
- [x] E1.4a y E1.4b: core, layouts y rutas.
- [x] E1.5a: tokens y tema.
- [ ] E1.5b+: completar el catálogo de componentes según cada feature. Ya hay piezas reutilizables; no está terminado todo el sistema de diseño.

### Fase 2: funcionalidades

- [x] E2.1: login, sesión, roles y guards; prueba manual registrada.
- [x] E2.2: búsqueda, paginación, edición y borrado básico, según commits.
- [x] E2.3a: formulario de alta de pacientes, según commits.
- [ ] E2.3b: revisiones con FK a paciente; ver, agregar y editar medidas.
- [ ] Eliminar/archivar por historial, autorización de supervisor y auditoría en servidor.
- [ ] E2.4: egresos y categorías.
- [ ] E2.5: historial de ventas, filtros y pagos.
- [ ] E2.6: vender, cálculos, autorización y recibo PDF.
- [ ] E2.7: métricas y gráficas del dashboard.
- [ ] E2.8: resinas, armazones, reportes, funcionalidades, auditoría y usuarios.

### Fases 3 y 4: calidad y revisión de datos

- [ ] Pruebas integrales de stores/repositorios, beta y checklist de paridad pantalla por pantalla. Hay tests de piezas actuales, pero eso no completa esta fase.
- [ ] Hosting beta y pruebas con usuarios reales.
- [ ] Revisión de esquema, índices, RLS y nombres en las tablas restantes.
- [ ] Migración, transform y registro por cada cambio restante.

Las mejoras de pacientes ya se hicieron por entregable; no se espera a la Fase 4 para agregar las futuras relaciones por ID.

### Fase 4b: multiempresa

- [ ] Organizaciones y sucursales como entidades.
- [ ] Aislamiento por organización en tablas y RLS.
- [ ] Moneda, métodos de pago, zona horaria, logo y tema por empresa.
- [ ] Alta de empresas e invitación de usuarios.
- [ ] Asignar los datos existentes a la organización correspondiente al corte.

### Fases 5 y 6: producción y backend futuro

- [ ] Ensayo de importación fresca de prod, migraciones y controles de integridad.
- [ ] Ventana de corte, congelación de Flutter, validación y cambio de aplicación oficial.
- [ ] Respaldo temporal del proyecto viejo y nuevo ambiente dev.
- [ ] API NestJS, autenticación y nuevas implementaciones de repositorio.
- [ ] Evaluación de monorepo para compartir tipos.

## 4. Decisiones del dueño

1. **Curso con Flutter como referencia:** teoría y comparaciones, sin ejercicios nuevos; cada lección también en PDF. Las lecciones previas se mantienen intactas en esta entrega.
2. **Features en paralelo al aprendizaje:** se retoma E2.2 sin esperar a F04–F06, según la decisión registrada el 26 de octubre.
3. **UI propia:** Tailwind y comportamiento oficial CDK/Aria; componentes compartidos por necesidad, sin una biblioteca visual externa.
4. **Menú por secciones:** se adopta la organización del diseño manteniendo permisos equivalentes a Flutter.
5. **Datos y ambientes:** mejoras en dev (optinova-db); prod (oftal-test-web) conserva el esquema heredado hasta un corte autorizado. Nunca se incluyen claves ni volcados de pacientes en esta entrega.
6. **IDs:** nuevos pacientes reciben el identificador de la DB; la app lo transporta como texto. Otras entidades se adaptarán en sus entregables.
7. **Nombres de columnas:** snake_case; español para negocio e inglés para columnas técnicas. Se aplica tabla por tabla.
8. **Relaciones por ID:** revisiones usarán paciente_id; el nombre viejo quedará como respaldo. Los casos ambiguos requieren revisión humana y no deben enlazarse a ciegas.
9. **Eliminar o archivar por historial:** sin relaciones, confirmación básica; con medidas, supervisor o autorización de uno; con ventas/pagos, archivo por admin y posibilidad de restaurar. Debe verificarse en servidor y registrar quién autoriza. Es una decisión aún pendiente de implementación.

El diagnóstico agregado registrado para revisiones contempla 17,330 filas: 16,503 coincidencias únicas, 357 resueltas con sucursal/fecha y unas 470 pendientes. Es una estimación del registro de trabajo, no una nueva consulta realizada para este informe.

## 5. Riesgos y pendientes concretos

- **Datos históricos y homónimos:** el aviso de nombre repetido ayuda, pero las relaciones por nombre siguen siendo frágiles hasta implementar las FK y revisar ambigüedades.
- **Borrado actual frente a política acordada:** la operación básica ya existe; faltan autorización, auditoría y archivo condicionado por historial. No se debe presentar la política futura como disponible.
- **Integridad de IDs:** mantener strings de extremo a extremo. Una conversión numérica accidental puede afectar pacientes de IDs grandes.
- **Corte reproducible:** ensayar en copia de prod; revisar conteos, fechas inválidas, teléfonos y posición de secuencia. Una importación posterior puede exigir recolocarla.
- **RLS de perfiles:** la política admin all perfiles consulta jwt_role(), pero el rol operativo vive en perfiles. Revisar la duplicidad según el pendiente del registro de DB.
- **Ambiente gratuito:** dev puede pausarse por inactividad. La prueba de E2.1 terminó aprobada; una pausa anterior no demuestra una incidencia vigente hoy.
- **Pruebas:** el status de Claude registra 90 tests en verde en su trabajo; esta entrega documental no ejecutó ni certificó de nuevo esa suite ni realizó pruebas manuales de E2.2/E2.3a.
- **Documentos históricos:** 00–04 conservan decisiones y pendientes de su fecha; el código, las lecciones nuevas y este informe explican la evolución. F04–F06 faltantes no se ocultan en el índice.
- **Seguridad de la entrega:** los PDF y el ZIP incluyen documentación; la copia de consulta de Flutter y los archivos temporales de revisión no entran en el paquete.

## 6. Entrega documental de esta sesión

Se preparan trece lecciones, este informe y un índice, con PDF regenerados desde Markdown y nombres ordenados. El paquete se guarda en `docs/informes/entrega/` y `docs/informes/optinova-docs-2026-10-26.zip`.

Los fuentes versionables quedan en `docs/` y las mejoras de generación en `scripts/docs/`. Los PDF y el ZIP siguen en la carpeta ignorada por Git. La generación no cambia las diez lecciones existentes: se verifican sus hashes antes y después. No se hizo commit ni push; la entrega queda pendiente de revisión del dueño.
