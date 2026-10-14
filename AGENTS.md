# AGENTS.md

Guía para cualquier IA o persona que trabaje en este repo. Léela completa antes de tocar código.

## Qué es este proyecto

`optinova-web` es la reescritura en **Angular** de `oftal_web` (Flutter web, en producción): https://github.com/MeloGon/oftal_web
Es un sistema de gestión para una óptica: pacientes y revisiones, ventas y pagos, egresos, armazones y resinas, reportes, auditoría y usuarios con roles.

**El proyecto también es un curso.** El dueño viene de Flutter/Dart y no conoce JS/HTML/CSS. Cada entregable debe:
1. Implementarse en pasos pequeños.
2. Explicarse en relación con su equivalente en Flutter/Riverpod/go_router.
3. Documentarse en `docs/lessons/NN-tema.md` y ampliar `docs/flutter-to-angular.md`.

Plan completo, fases y estado: **`docs/migration-plan.md`**. Revísalo al empezar cualquier sesión.

## Stack

- Angular (última estable): standalone components, signals, `@if/@for`, zoneless. **No** usar NgModules, `*ngIf`/`*ngFor` ni patrones viejos.
- TypeScript estricto.
- UI propia: Tailwind CSS v4 + `@angular/cdk` + `@angular/aria` (headless). **No** usar librerías de UI de terceros (PrimeNG, Material, spartan). El diseño sale de Claude Design (`docs/design/`); cada componente vive en `src/app/shared/ui/` y lleva su ID en un comentario (`// C-01 Button`).
- Supabase (`@supabase/supabase-js`). Más adelante, NestJS.

## Bases de datos (CRÍTICO)

| Ambiente | Ref | Regla |
|---|---|---|
| PROD (viejo, Flutter) | `gutgxjgfjbodznzjiqtm` | **NUNCA escribir.** Solo lectura. |
| DEV / futura prod (`optinova-db`) | `dqofpmpyxumkzlsqcjri` | Aquí se desarrolla. |

- Todo cambio de esquema = migración en `supabase/migrations/` + transform de datos en `supabase/transforms/` + entrada en `docs/db-changes.md`.
- DEV tiene datos reales de pacientes: nunca subir keys ni volcados de datos al repo.

## Arquitectura (equivalente a la de Flutter)

```
src/app/
  core/            # cliente supabase, Result, modelos, repos abstractos + impl, guards
  shared/          # componentes, pipes y utils reutilizables
  layouts/         # auth-layout, dashboard-layout (sidebar + navbar)
  features/<feature>/
    <feature>.store.ts        # = viewmodel/Notifier de Riverpod (signals)
    <feature>.page.ts         # = View (página de ruta)
    components/               # = views/widgets
```

Flujo: **page → store → repository (abstracto) → repository impl (Supabase) → supabase-js**.
Las vistas nunca llaman a Supabase directamente. Así, cuando llegue NestJS, solo se cambia la implementación del repo.

### Cómo crear una feature nueva
1. Modelo/interfaz en `core/models/` si hace falta (equivalente a freezed model).
2. Repositorio abstracto en `core/repositories/` y su implementación Supabase en `core/data/`, que devuelva `Result<T, AppError>`.
3. Store (`@Injectable()`) con `signal` privado de estado, `asReadonly()` público y métodos async. Proveerlo en `providers: []` de la página (= `autoDispose`). Si debe ser global, `providedIn: 'root'` (= `keepAlive`).
4. Página standalone + componentes hijos. Layout con Tailwind, controles de `shared/ui/`.
5. Ruta lazy en `app.routes.ts` y guard por rol si aplica.
6. Lección en `docs/lessons/`, glosario actualizado y checkbox en el plan.

## Convenciones

- Ramas: se trabaja en `development`; `main` solo recibe lo estable.
- Datos de DEV: `supabase/seed.sql` (falsos, re-ejecutable). Nunca cargar datos reales salvo el corte final.
- Código (identificadores, archivos) en inglés. Docs, lecciones y commits en español.
- Archivos en kebab-case: `search-patient.page.ts`, `patient.repository.ts`.
- Commits cortos, en español, con prefijo convencional, **sin** `Co-Authored-By` ni trailers de IA:
  - `feat(login): agrega guard de rutas por rol`
  - `fix(sell): corrige cálculo de descuento`
  - `docs(lessons): agrega lección de signals`
- **Nunca** hacer `git commit` ni `git push` sin aprobación explícita del dueño para ese commit: proponer el mensaje y esperar el "sí".
- Antes de cualquier cambio (código, DB, RLS) explicar qué se hará y por qué, con paciencia, en lenguaje simple y con analogías de Flutter. El dueño está aprendiendo.
- Nombres de ambientes al hablar: **prod (oftal-test-web)** y **dev (optinova-db)**. Las mejoras se hacen en dev; prod solo con autorización explícita de un cambio concreto.
- Multi-empresa: ver "Reglas desde ya" en la Fase 4b del plan (nada de sucursales, moneda ni métodos de pago escritos a mano).

## Trabajar desde otra computadora

1. Instalar Node 24 LTS, Git y Angular CLI (`npm install -g @angular/cli`).
2. `git clone https://github.com/MeloGon/optinova-web` y luego `git checkout development`.
3. `npm install` y luego `npm start` (abre en http://localhost:4200).
4. Configurar la identidad de git del repo (`git config user.name` / `user.email`).
5. Opcional, solo para `scripts/db/clone-prod-to-dev.ps1`: cliente PostgreSQL 17.
6. Al abrir una sesión con una IA: que lea este archivo y `docs/migration-plan.md`. La memoria de la IA no viaja entre computadoras; el contexto vive en estos docs.

## Comandos

```bash
npm install          # = flutter pub get
ng serve             # = flutter run -d chrome  (http://localhost:4200)
ng build             # = flutter build web
ng test
ng generate component features/x/components/y
```
(Se completan cuando exista el scaffold.)
