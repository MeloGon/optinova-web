# L01: Tokens de diseño y tema (E1.5a)

## Qué se hizo

Se trajeron a la app los tokens del sistema de diseño (pedido D-001, T-01..T-07) y un servicio que controla la apariencia:

| Archivo | Origen | Qué hace |
|---|---|---|
| `src/styles.css` | `export/optinova-theme.css` (Claude Design) | Todos los tokens: colores, tipografía, radios, sombras, movimiento, modo oscuro y densidad |
| `src/app/core/theme/primary-scale.ts` | `export/primary-scale.ts` (Claude Design) | Genera la escala 50–950 del primario a partir de un solo color, con contraste AA |
| `src/app/core/theme/theme.service.ts` | nuevo | Guarda y aplica modo (claro/oscuro/sistema), densidad y primario |
| `src/index.html` | editado | Carga las fuentes Geist y pone el tema antes de pintar |

Los dos archivos de Claude Design **no se editan a mano**: si cambia el diseño, se vuelven a copiar desde el artifact.

## Tokens = `ThemeData`

En Flutter defines un `ThemeData` y los widgets leen `Theme.of(context).colorScheme.primary`. Aquí el `ThemeData` es un bloque `@theme` en `styles.css`:

```css
@theme {
  --color-primary: var(--color-primary-600);
  --color-card: var(--color-neutral-0);
  --radius-md: 8px;
  --text-heading: 16px;
}
```

Tailwind lee ese bloque y crea clases con esos nombres:

| Token | Clase Tailwind | En Flutter |
|---|---|---|
| `--color-primary` | `bg-primary`, `text-primary` | `colorScheme.primary` |
| `--color-primary-foreground` | `text-primary-foreground` | `colorScheme.onPrimary` |
| `--color-card` | `bg-card` | `colorScheme.surface` |
| `--color-muted-foreground` | `text-muted-foreground` | `textTheme.bodySmall.color` |
| `--radius-lg` | `rounded-lg` | `BorderRadius.circular(12)` |
| `--text-heading` | `text-heading` | `textTheme.titleMedium` |
| `--shadow-sm` | `elev-sm` | `elevation: 1` |

Regla del sistema: **nunca un hex en un componente**. Siempre el token. Es como no escribir `Color(0xFF1F6FE5)` dentro de un widget.

`--color-*: initial` borra la paleta por defecto de Tailwind (`slate`, `blue`…): solo existen nuestros colores.

## Modo oscuro = `darkTheme`

En Flutter tienes `theme` y `darkTheme` en `MaterialApp`. Aquí los mismos tokens se **redefinen** cuando `<html>` tiene `data-theme="dark"`:

```css
[data-theme="dark"] {
  --color-card: var(--color-neutral-900);
  --color-foreground: var(--color-neutral-50);
}
```

Los componentes no preguntan en qué modo están: `bg-card` sigue siendo `bg-card`, solo cambia su valor. Igual que un widget que lee `colorScheme.surface` y no sabe si es claro u oscuro.

## Densidad

`data-density="compact"` en `<html>` cambia variables como `--onv-row-h` (44px → 32px). Los componentes las usan con la sintaxis de Tailwind para variables: `h-(--onv-row-h)`. Es como un `VisualDensity` que cambia toda la app.

## Primario personalizable

`primary-scale.ts` toma **un** color y calcula 11 tonos (50–950) en OKLCH, un espacio de color donde la luminosidad es predecible. Así cualquier color que elija el cliente mantiene contraste legible. Es como `ColorScheme.fromSeed(seedColor: ...)` de Material 3.

`applyPrimary(hex)` mete un `<style id="optinova-primary">` en la página con los nuevos valores; como va después de `styles.css`, gana.

## `ThemeService` = Notifier con `keepAlive`

```ts
@Injectable({ providedIn: 'root' })        // una instancia para toda la app = keepAlive
export class ThemeService {
  private readonly state = signal<ThemePrefs>(this.load());   // = state del Notifier
  readonly mode = computed(() => this.state().mode);           // = select(...)
  readonly isDark = computed(() => ...);                       // = provider derivado

  setMode(mode: ThemeMode) {                                   // = método del Notifier
    this.update({ mode });       // state = state.copyWith(mode: mode) + guardar
    this.applyAttributes();      // pone data-theme en <html>
  }
}
```

- El estado es privado; afuera solo se leen los `computed` (de solo lectura).
- `localStorage` = `SharedPreferences`: guarda las preferencias en el navegador.
- `matchMedia('(prefers-color-scheme: dark)')` = `MediaQuery.platformBrightnessOf(context)`; se escucha su `change` para el modo "Sistema".

### Arrancarlo al inicio

En `app.config.ts`:

```ts
provideAppInitializer(() => { inject(ThemeService); }),
```

Un servicio `providedIn: 'root'` es perezoso: no existe hasta que alguien lo pide. Esto lo crea al arrancar, como hacer `ref.read(themeProvider)` en `main()` antes de `runApp`.

## El script en `index.html`

Angular tarda unos milisegundos en arrancar. Sin ayuda, un usuario en modo oscuro vería un destello blanco. Un script corto en `<head>` lee `localStorage` y pone `data-theme` **antes** de pintar. Usa la misma clave (`optinova.theme`) que `ThemeService`.

## Pruébalo

`npm start` → en la pantalla de prueba cambia color, tema y densidad, y recarga: se conserva.

## Pendiente

- Componentes `C-xx` en `src/app/shared/ui/` (E1.5b en adelante).
- Cuando exista configuración por empresa (Fase 4b), el primario por defecto vendrá de `core/config`, no de `PRESETS[0]`.
