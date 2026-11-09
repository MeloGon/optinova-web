# Transform #27: revisiones con nombre repetido, enlazadas por venta cercana

Migración: `supabase/migrations/20261108120000_revisiones_enlace_por_venta.sql`. Corre después de la #8
(usa `ventas.paciente_id`). Pedido y aprobado por el dueño el 2026-11-08.

## Por qué

La #7 enlazó cada revisión a su paciente por nombre. Las que tienen un nombre repetido (2 o más
fichas con el mismo nombre) y no se desempataron por sucursal y fecha de registro quedaron sin
`paciente_id`: 348 en la copia de PROD del 2026-11-08. No se pierde nada (conservan el nombre), pero
no aparecen en ninguna ficha de paciente.

## Qué hace

Enlaza una revisión a un candidato cuando **solo ese candidato** tiene una venta a ±45 días de la
fecha de la revisión (quien se hace un examen suele comprar lentes poco después).

Medición en DEV con 3,000 revisiones ya enlazadas con certeza: el paciente correcto tiene una venta
cercana en el **88.2 %** de los casos y uno al azar en el **5.5 %**, es decir, un acierto estimado de
~99 % cuando solo un candidato la tiene (con homónimos reales puede ser algo menor).

## Qué NO hace (quedan sin enlazar, con el nombre guardado)

De las 348:

| Grupo | Revisiones | Por qué no se enlaza |
|---|---|---|
| **Enlazadas por esta migración** | 168 | un solo candidato con venta cercana |
| **Misma persona registrada 2+ veces** | 123 | todos los candidatos comparten nacimiento o teléfono; elegir una ficha dejaría la otra vacía. Se resuelve uniendo fichas duplicadas (decisión del dueño, fuera de esta migración) |
| **Sin pista segura** | 57 | 48 sin ningún candidato con venta cercana y 9 con varios |

Fechas (copia del 2026-11-08): las 168 van de 2016 a 2025 (solo 1 de 2026); las 123 duplicadas, de
2016 a 2026 (20 de 2026, de marzo a octubre: se siguen creando fichas duplicadas); las 57, de 2015 a
2026 (39 de 2026).

## Detalles

- Es una corrección de datos: se apaga `trg_revisiones_updated_at` mientras corre para no cambiar
  `updated_at`, y se vuelve a encender.
- Re-ejecutable: solo toca revisiones sin `paciente_id`, y nunca cambia un enlace existente.
- En el corte (Fase 5) se vuelve a correr sobre una copia fresca de PROD.

## Verificado en DEV (2026-11-08, transacción revertida)

- 16,922 enlazadas / 452 sin enlazar antes → 17,090 / 284 después (**+168**).
- 0 enlaces previos cambiados, 0 `updated_at` modificados, trigger de nuevo activo.
- Segunda ejecución: `UPDATE 0`.
- Aplicada en DEV el 2026-11-09, después de que Antigravity terminó la prueba de la #26.

## Relacionado

Las ventas que Flutter dejó sin id de paciente desde septiembre de 2025 se enlazan en la #28. Esa
migración no cambia estas 168 (las ventas de sus candidatos tienen nombre repetido).
