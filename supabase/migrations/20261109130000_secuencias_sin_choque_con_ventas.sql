-- Cambio #29: las secuencias de resinas y armazones arrancan por encima de lo que ya aparece en
-- las líneas de venta, para que un producto nuevo nunca herede el id de uno viejo.
--
-- Hallazgo de Antigravity (2026-11-09): en la copia de PROD las resinas reales tienen ids al azar de
-- 17 dígitos, pero `resinas_id_oftalmico_seq` estaba en 4. Una resina nueva recibía el id 1, 2 o 3,
-- que ya existen en `venta_items.id_oftalmico` de ventas históricas (de otra resina que hoy no
-- existe): `remove_resin` la tomaba por "ya vendida" y la archivaba en vez de borrarla, y cualquier
-- consulta que cruce líneas con resinas habría mezclado productos distintos.
--
-- La secuencia de armazones (#18) ya arranca arriba, pero solo miraba `armazones`; ahora considera
-- también `venta_items.id_montura` (14,770 líneas apuntan a armazones que ya no existen).
--
-- Nunca baja una secuencia: toma el mayor entre el valor calculado y el que ya tiene.

select setval(
  pg_get_serial_sequence('public.resinas', 'id_oftalmico'),
  greatest(
    coalesce((select max(id_oftalmico) from public.resinas), 0),
    coalesce((select max(id_oftalmico) from public.venta_items), 0)
  ) + 1,
  false
)
where greatest(
    coalesce((select max(id_oftalmico) from public.resinas), 0),
    coalesce((select max(id_oftalmico) from public.venta_items), 0)
  ) + 1 > (select last_value from public.resinas_id_oftalmico_seq);

select setval(
  pg_get_serial_sequence('public.armazones', 'id'),
  greatest(
    coalesce((select max(id) from public.armazones), 0),
    coalesce((select max(id_montura) from public.venta_items), 0)
  ) + 1,
  false
)
where greatest(
    coalesce((select max(id) from public.armazones), 0),
    coalesce((select max(id_montura) from public.venta_items), 0)
  ) + 1 > (select last_value from public.armazones_id_seq);
