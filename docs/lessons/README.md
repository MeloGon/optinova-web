# Lecciones

Una lección por entregable. Cada una explica qué se hizo, para qué sirve y su equivalente en Flutter.

| # | Tema | Entregable |
|---|---|---|
| 00 | [Anatomía de un proyecto Angular](00-proyecto-angular.md) | E1.3 |
| 01 | [Tokens de diseño y tema](01-tokens-y-tema.md) | E1.5a |
| 02 | [El núcleo (`core/`)](02-core.md) | E1.4a |
| 03 | [Layouts y rutas](03-layouts-y-rutas.md) | E1.4b |
| 04 | [Login, sesión, roles y guards](04-login-sesion-roles.md) | E2.1 |
| 05 | [Buscar, editar y eliminar paciente](05-buscar-paciente.md) | E2.2 |
| 06 | [Agregar paciente](06-agregar-paciente.md) | E2.3a |
| 07 | [Base de datos: IDs, fechas y columnas](07-base-de-datos-ids-fechas-columnas.md) | Cambios #3–#6 |

## Fundamentos desde Flutter y Dart

| # | Lectura | Estado de la documentación |
|---|---|---|
| F00 | [Mapa del ecosistema web](fundamentos/F00-mapa-ecosistema-web.md) | Disponible |
| F01 | [TypeScript desde Dart, primera parte](fundamentos/F01-typescript-desde-dart.md) | Disponible |
| F02 | [Objetos y organización de TypeScript](fundamentos/F02-typescript-desde-dart-objetos.md) | Disponible |
| F03 | [HTML y árbol de etiquetas](fundamentos/F03-html-arbol-etiquetas.md) | Disponible |
| F04 | CSS y Tailwind | Pendiente |
| F05 | Componentes y signals | Pendiente |
| F06 | Servicios e inyección | Pendiente |
| F07 | [Recorrido de E2.1](fundamentos/F07-recorrido-e2-1.md) | Revisada y aprobada por el dueño el 2026-10-26 |

Las lecciones nuevas son teoría con ejemplos comparados, sin ejercicios. 00–04, F00–F03 y F07 se conservan sin modificar su contenido: son documentos de su entregable, por lo que algunos pendientes o detalles históricos ya evolucionaron. Para el estado al 26 de octubre se debe leer el [informe de avance](../avance/2026-10-26-informe-de-avance.md) y las lecciones 05–07.

## PDF y entrega para Drive

Una lección: `npm run pdf -- docs/lessons/05-buscar-paciente.md`.

Entrega completa: `node scripts/docs/build-delivery.mjs`. El script invoca el comando npm de PDF, regenera las trece lecciones y el informe, agrega un índice y prepara la carpeta `docs/informes/entrega/` junto a `docs/informes/optinova-docs-2026-10-26.zip`. En Windows puede usarse `npm.cmd` al ejecutar manualmente los comandos si PowerShell bloquea `npm.ps1`.

Se usa un script directo porque el alcance de esta entrega solo permite modificar `docs/` y `scripts/docs/`; no se cambia `package.json` para registrar `pdf:all`. El contenido del ZIP es únicamente la carpeta `entrega/`, sin repositorios de referencia ni temporales de revisión.
