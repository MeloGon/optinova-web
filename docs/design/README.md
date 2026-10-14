# Sistema de diseño: trazabilidad

El diseño se hace con **Claude Design** y se implementa con **Tailwind + `@angular/cdk` + `@angular/aria`** (sin librerías de UI de terceros).
Esta carpeta guarda cada pedido a Claude Design y lo que salió de él, para saber siempre de dónde viene cada decisión.

## Identificadores (no cambian nunca)

| Prefijo | Qué es | Ejemplo |
|---|---|---|
| `T-xx` | Grupo de tokens (colores, tipografía, espacios...) | `T-01 Color` |
| `C-xx` | Componente | `C-01 Button` |
| `P-xx` | Patrón (combinación de componentes) | `P-03 Barra de filtros` |
| `S-xx` | Pantalla de ejemplo | `S-02 Dashboard` |
| `D-xxx` | Pedido (prompt) a Claude Design | `D-001 Sistema base` |

Si algo se elimina, su ID no se reutiliza.

## Flujo

1. Se escribe el pedido en `prompts/D-xxx-tema.md` (qué se pide y qué IDs afecta).
2. Se pega en Claude Design. El enlace del resultado se anota en `design-log.md`.
3. Se registran en `design-log.md` las decisiones tomadas y los IDs creados o modificados.
4. Al implementar en Angular, cada componente lleva su ID en un comentario (`// C-01 Button`).
5. Un pedido nuevo que cambie algo anterior lo cita por ID (por ejemplo, "modifica C-07 Table v1 → v2").

## Archivos

- `prompts/`: pedidos enviados a Claude Design, uno por archivo.
- `design-log.md`: historial de versiones e inventario de IDs con su estado.
