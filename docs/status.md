# Estado del proyecto

> Tablero compartido entre agentes (Claude, Codex, Antigravity). Roles y reglas: `AGENTS.md`.
> Detalle de fases y checkboxes: `docs/migration-plan.md`.
> Cada agente actualiza esto al cerrar una tarea. Última actualización: 2026-10-26 (Codex, entrega documental completa).

## Hecho

- Fase 1 (infraestructura): herramientas, esquema clonado a DEV, seed, scaffold Angular, tokens y tema, core, layouts y rutas.
- E2.1 Login, sesión, guards y roles: commit `765c39e` del 2026-10-23; marcado y registrado en el plan. F07 (recorrido didáctico) revisada y aprobada por el dueño el 2026-10-26.
- Fase 0: lección F01 (TypeScript desde Dart) y generador de PDF, commit `8b30961` del 2026-10-23; marcado y registrado en el plan.
- Codex (2026-10-26): sincronizó `development`, comprobó los commits de F01 y E2.1 y actualizó fecha, checkboxes y Registro de `migration-plan.md`.
- Codex (2026-10-26): preparó F00, F02 y F03, una por una, con teoría y ejemplos comparados con Flutter/Dart, sin ejercicios. Markdown en `docs/lessons/fundamentos/`; PDF generados con `npm.cmd run pdf -- <lección.md>` en `docs/informes/` y revisados visualmente. Glosario ampliado. El dueño aprobó el commit el 2026-10-26; checkboxes de F00, F02 y F03 marcados.
- Codex (2026-10-26): preparó `docs/lessons/fundamentos/F07-recorrido-e2-1.md`, siguiendo el código actual desde modelos y repositorio hasta sesión, guards, login, menú y topbar. Solo teoría, comparaciones con Flutter/Riverpod/go_router y sin ejercicios. PDF generado en `docs/informes/F07-recorrido-e2-1.pdf` y revisado visualmente; glosario ampliado. Revisada y aprobada por el dueño el 2026-10-26, junto con su inclusión en el commit documental.
- Codex (2026-10-26): preparó L05 Buscar paciente, L06 Agregar paciente y L07 IDs/fechas/columnas, contrastando Angular hasta `e3ef363` y Flutter `7d3fa5f`. Amplió glosario e índice de lecciones, consolidó el plan y escribió `docs/avance/2026-10-26-informe-de-avance.md`. Regeneró trece lecciones, informe e índice; entrega de 15 PDF en `docs/informes/entrega/` y ZIP `docs/informes/optinova-docs-2026-10-26.zip`. Markdown de las diez lecciones previas conservado por hash; cambios limitados a `docs/` y `scripts/docs/`. Los dos commits y su push a development fueron aprobados por el dueño el 2026-10-26.
- Codex, verificación final (2026-10-26): revisión visual de los 15 PDF (68 páginas), sin páginas vacías ni texto fuera de márgenes; 10 fuentes protegidos idénticos por SHA-256 y 15 entradas ZIP con tamaño y SHA-256 iguales a la carpeta entrega. Mensajes propuestos: `docs(lessons): agrega lecciones de pacientes e informe de avance` y `fix(docs): mejora PDFs y automatiza la entrega completa`. El dueño aprobó ambos mensajes y la inclusión de F07 en el commit documental el 2026-10-26.
- DB: 7 archivos de migración (baseline y cambios #1–#6) y 4 documentos de transform (#3–#6); fuente: repositorio y `docs/db-changes.md`.

## En curso

| Agente | Tarea | Desde |
|---|---|---|
| Codex | Entrega documental terminada y aprobada, incluida F07; checkbox actualizado. Publicación de los dos commits autorizada a development; sin tarea documental adicional activa | 2026-10-26 |
| Claude | E2.2 Buscar paciente completo en `development` (commits locales; push pendiente) y E2.3-0 (IDs como texto + migración #5). E2.3a Agregar paciente (commit `ef10044`). Migración #6: columnas de `pacientes` con nombres limpios y teléfono secundario (90 tests en verde), pendiente de prueba manual del dueño y commit. Sigue E2.3b: revisiones (FK a paciente, ver/agregar/editar medidas) | 2026-10-26 |
| Antigravity | Prueba manual de E2.1 finalizada con éxito (aprobada al 100%) | 2026-10-26 |

## Siguiente

1. Entrega documental y del generador aprobada por el dueño; publicación autorizada a development.
2. Lecciones F04–F06 en paralelo al desarrollo, según decisión del dueño.
3. F07 completada y aprobada; la lección fuente se conserva sin cambios al regenerar el PDF.
4. E2.3b revisiones y borrado/archivo por historial; E2.2 y E2.3a ya tienen commits.
5. E1.5b Componentes `C-xx`, a demanda de cada feature.

## Referencias

- App Flutter original (solo lectura, fuente de verdad del comportamiento): https://github.com/MeloGon/oftal_web. No usar rutas locales: el dueño trabaja en dos computadoras.
- E2.2 Buscar paciente en Flutter: `lib/features/search_patient/` (viewmodels, views, widgets).

## Decisiones de diseño (dueño, 2026-10-26)

- **Medidas y ventas enlazadas por ID, no por nombre.** `revisiones.paciente_id` (FK a `pacientes`); el nombre viejo queda en `paciente_nombre` solo como respaldo. Se llena en la migración, que sirve igual sobre DEV y sobre una copia de PROD. En PROD: de 17,330 revisiones, 16,503 coinciden con un solo paciente, 357 se resuelven por sucursal + fecha de registro, y unas 470 (366 ambiguas, 42 sin paciente, 62 sin nombre) quedan con `paciente_id` vacío en una consulta de revisión manual. `ventas cortas` ya trae `ID PACIENTE` (23,017 de 24,807 válidos); se limpia con su entregable (E2.5/E2.6).
- **Eliminar paciente por niveles.** Sin datos relacionados: cualquier rol, con confirmación. Con medidas: supervisor o superior; un vendedor necesita que un supervisor o superior ingrese su correo y contraseña (P-04), se verifica en el servidor y queda en `audit_logs` quién autorizó; se borran paciente y medidas. Con ventas o pagos: no se borra, se **archiva** (un admin o superior; deja de salir en búsquedas y ventas nuevas, conserva historial y se puede restaurar). La regla se aplica en la base de datos / Edge Function, no solo en pantalla.
- **IDs** de pacientes asignados por la DB (secuencia, migración #5); en la app viajan como texto. `revisiones` y `ventas` tendrán lo mismo con su entregable.

## Pendientes entre agentes

- [2026-10-26] de Claude para Codex: decisiones de diseño llevadas al plan por Codex: E2.3b con FK, entregable de eliminar/archivar con autorización y FK por feature. Commit documental aprobado por el dueño el 2026-10-26.

- [2026-10-26] del Dueño para Claude y Codex: se retoma el desarrollo de features con E2.2 Buscar paciente (el dueño decidió no esperar F04–F06). Claude implementa el código. Codex lee `lib/features/search_patient/` del repo de Flutter (ver Referencias) y escribe `docs/lessons/10-buscar-paciente.md` (+ PDF) con lo que hace Flutter y su equivalente Angular, sin tocar `src/`.
- [2026-10-26] de Antigravity para Dueño / Claude: **Prueba manual y funcional de E2.1 en `ng serve` con los 4 usuarios del seed: APROBADA al 100%.**
  - **Prueba de credenciales erróneas:** Al ingresar contraseña equivocada, se muestra correctamente el mensaje traducido `"Correo o contraseña incorrectos."` en la alerta y se permanece en `/auth/login`.
  - **Prueba con los 4 usuarios (`OptinovaDev2026`):**
    - `vendedor@optinova.test`: entra a `/dashboard`, Topbar muestra `Vendedor Prueba`, `Vendedor`, `MEDILENT`; Sidebar muestra exactamente **6 ítems**; intento de entrar a `/dashboard/settings/resins` es bloqueado por `roleGuard` y redirige a `/dashboard`.
    - `supervisor@optinova.test`: entra a `/dashboard`, Topbar muestra `Supervisor Prueba`, `Supervisor`, `MEDILENT`; Sidebar muestra exactamente **7 ítems** (+ `Ingresos y egresos`); accede a `/dashboard/settings/payments-report` correctamente y es bloqueado por `roleGuard` al intentar entrar a `/dashboard/settings/users-management`.
    - `admin@optinova.test`: entra a `/dashboard`, Topbar muestra `Admin Prueba`, `Admin`, `OFTALVISION`; Sidebar muestra exactamente **12 ítems** (+ Inventario y Administración); bloqueado al intentar entrar a `/dashboard/settings/users-management`.
    - `megadmin@optinova.test`: entra a `/dashboard`, Topbar muestra `Mega Admin Prueba`, `Megadmin`, `OFTALVISION`; Sidebar muestra todos los **13 ítems** (+ Súper administración con `Usuarios`); acceso permitido a todas las rutas protegidas.
  - **Persistencia de sesión:** Al recargar la página (F5) en `/dashboard`, `provideAppInitializer` restaura la sesión de Supabase de inmediato sin parpadeos ni pérdidas de datos de perfil.
  - **Cierre de sesión:** Al desplegar el menú de usuario (CDK Menu) y pulsar `"Cerrar sesión"`, redirige limpiamente a `/auth/login`, borra la sesión y `authGuard` bloquea cualquier intento de regresar a `/dashboard`.
  - **Conclusión:** Paridad total contra Flutter alcanzada. E2.1 validado y listo sin observaciones.

## Pendientes conocidos

- `supabase/transforms/` ya existe con los documentos #3–#6; queda pendiente ensayar las conversiones sobre una copia fresca de prod antes del corte.
- RLS: `perfiles."admin all perfiles"` usa `jwt_role()` que nunca aplica; revisar en Fase 4.
