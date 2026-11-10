# Guion del corte: de Flutter (PROD viejo) a Angular (`optinova-db`)

Estado: **borrador listo para revisar con el dueño** (2026-11-09, Claude). Todavía no hay fecha.
Cuándo ejecutar: ver "Antes de fijar la fecha".

## Idea en una frase

`optinova-db` (`dqofpmpyxumkzlsqcjri`) pasa a ser la base de producción. Se vacía, se copia PROD viejo
(`gutgxjgfjbodznzjiqtm`) fresco, se aplican las migraciones #3 a #37 y se apunta la app Angular a ella.
El corte es una **reimportación completa**, no un delta (las tablas no tienen `updated_at`).
PROD viejo solo se lee, siempre.

Este guion es el ensayo del 2026-11-09 (ver `docs/plan-clonacion-prod.md`) con tres cosas más: congelar
Flutter, limpiar datos de prueba y verificar antes de abrir.

## Antes de fijar la fecha (lista de salida)

- [ ] Todo lo que se quiera probar en navegador ya está probado por Antigravity sobre una copia reciente.
- [ ] Commits de #30, #31 y el ensayo subidos (`git push` con el "sí" del dueño) y `main` al día con lo estable.
- [ ] Decidido dónde se aloja la app Angular y su dominio (**por definir**: el repo no lo dice).
- [ ] Decidido qué pasa con Flutter después del corte (ver "Después del corte").
- [ ] Fase 4b hecha (#32 a #36, pantalla de sucursales). Falta probarla en navegador con cuentas reales.
- [ ] "Leaked password protection" activado en el dashboard de Supabase de `optinova-db` (lo hace el dueño).
- [ ] Mejor hora: fuera de horario de la óptica (poca venta). Avisar al personal con anticipación.

## Preparación (días antes, no toca nada)

1. En `optinova-db`: Auth -> URL Configuration. Site URL y redirects con el dominio final de Angular.
2. Edge Functions desplegadas y con sus secretos en `optinova-db`: `megadmin-users`, `patients-lifecycle`,
   `authorize-discount`. El clon **no** las toca (solo vacía `public` y `auth.users`). Comprobar que existen y responden.
3. `.env.local` / `environment` de producción de Angular apuntando a `optinova-db` (publishable key). Sin keys en el repo.
4. Última prueba general: repetir el ensayo completo (clonar + #3 a #37) uno o dos días antes y compararlo con la huella.
5. Copia de seguridad del ensayo: guardar los conteos finales del ensayo para comparar.

## Ventana de corte (en orden)

Duración estimada: el clon y las 29 migraciones tardaron pocos minutos en el ensayo. Reservar 1 hora completa.

1. **Congelar Flutter.** Avisar al personal: nadie vende ni registra desde este momento. Mientras Flutter
   siga escribiendo, la copia queda desactualizada. Anotar la hora.
2. **Huella de PROD viejo** (solo lectura): conteos de las 15 tablas y sumas de `ventas.total`, `pagos.monto`.
   Se guardan para comparar al final.
3. **Clonar con datos:** `./scripts/db/clone-prod-to-dev.sh --with-data` (pide escribir `SI`; vacía `optinova-db`).
   Debe terminar en "OK: PROD y DEV tienen los mismos conteos". Como Flutter está congelado, ya no debe haber diferencias.
4. **Migraciones #3 a #37**, una por una:
   ```bash
   export PATH=/opt/homebrew/opt/libpq/bin:$PATH
   DEV=$(grep -E '^DEV_DB_URL=' .env.db | cut -d= -f2- | tr -d "\"'")
   for f in $(ls supabase/migrations/*.sql | sed -n '3,37p'); do
     echo "$f"; psql "$DEV" --single-transaction -v ON_ERROR_STOP=1 -q -f "$f" || break
   done
   ```
   Si una falla: parar, **no seguir**, ver "Si algo sale mal".
5. **Verificar la huella** (resultado esperado del ensayo, ajustado a los datos del día):
   - ventas y `total` iguales a PROD viejo; `pagos` y `monto` iguales;
   - 191+ líneas en `venta_items_huerfanos` (crece si Flutter creó más), ventas sin líneas igual que PROD;
   - 0 nacimientos en el futuro; folio siguiente 997 834 o más;
   - pacientes archivados = unidos (#30) + vacíos (#31) + 24 de prueba (#37) del día;
   - 0 ventas colgadas de pacientes archivados por #30 y #31 (las 16 ventas de las fichas de prueba de #37 sí quedan colgadas, a propósito);
   - 0 sucursales con `descuento_requiere_autorizacion` encendido;
   - 0 cuentas `@optinova.test` y 0 pacientes `AGY%`.
6. **Pacientes de prueba:** la migración #37 (ya dentro de la cadena) archiva los 24 de PROD. Comprobar que los pacientes activos bajaron en 24 respecto a #31 y que las ventas siguen iguales.
7. **Advisors de Supabase** sobre `optinova-db`: sin hallazgos nuevos (solo el INFO esperado de `venta_items_huerfanos`).
8. **Prueba de humo en navegador** con cuentas reales (cada rol): entrar, buscar un paciente, ver una ficha con su historial,
   dashboard, historial y reportes. No vender de prueba: la venta quedaría en la base real. Los usuarios tendrán que
   volver a entrar (las sesiones de Flutter no sirven).
9. **Abrir:** publicar la app Angular con la configuración de `optinova-db`. Avisar al personal.
10. **Flutter:** no se usa más para escribir (ver abajo). No se borra.

## Si algo sale mal

- **Antes del paso 9** (nadie usa Angular aún): no se pierde nada. PROD viejo no se tocó. Se descarta `optinova-db`, se corrige,
  se repite desde el paso 3. Flutter se descongela y el personal sigue trabajando como siempre.
- **Después del paso 9** hay un punto sin vuelta fácil: lo que se registre en Angular vive en `optinova-db` y no en PROD viejo.
  Volver a Flutter perdería esas ventas. Por eso: no abrir (paso 9) sin haber pasado el paso 8.
  Si hay que volver, antes se exportan las ventas, pagos y pacientes nuevos de `optinova-db` para cargarlas a mano.
- Una migración que falla se revierte sola (`--single-transaction`). Arreglar el `.sql`, comprobar la huella y seguir.

## Después del corte

1. **Decidir qué pasa con PROD viejo y Flutter.** El plan de clonación dice que Flutter sigue vivo como respaldo; la Fase 5 dice
   retirarlo. Si alguien lo sigue usando, sus datos ya no llegan a Angular. Lo más seguro: PROD viejo solo lectura
   (quitar permisos de escritura o pausar el acceso de Flutter), pero **no** pausar el proyecto hasta pasar unas semanas.
   **Decisión pendiente del dueño.**
2. Mantener PROD viejo unas semanas como respaldo; luego pausarlo y, si todo está bien, borrarlo.
3. Crear un proyecto DEV nuevo con datos falsos (`supabase/seed.sql`) para seguir desarrollando. `optinova-db` deja de ser el DEV.
4. Primeros días: vigilar Auditoría, Dashboard y los reportes; revisar con el personal que las fichas muestren su historial.
5. Marcar las casillas de la Fase 5 en `docs/migration-plan.md` y anotar el cierre en `docs/status.md`.

## Pendientes conocidos que no bloquean el corte

- ~100 grupos de fichas con una sola coincidencia (teléfono o nacimiento): revisión manual del dueño, después.
- 114 ventas con nombre repetido y 28 sin ficha: se quedan con su nombre, sin ficha (decisión del dueño).
- 17 fichas sin nombre con ventas históricas: se quedan.
- "Cliente de paso" (37 fichas, 305 ventas): se deja.
- Cerrar escrituras directas por RLS (Fase 4) y la política `jwt_role()` de `perfiles`.
- Moneda, métodos de pago y zona horaria por empresa; admin que crea usuarios de su empresa; Edge Function `create_organization` sin probar de punta a punta.

## Quién hace qué

| Paso | Quién |
|---|---|
| Avisar al personal, congelar y abrir | Dueño |
| Clonar, migraciones, huella y advisors | Claude (con el "sí" del dueño antes de vaciar `optinova-db`) |
| Prueba en navegador | Antigravity y dueño |
| Protección de contraseñas filtradas, dominio y despliegue | Dueño |
| Plan, status y registro | Codex |
