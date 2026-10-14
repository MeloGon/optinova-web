# L00: Anatomía de un proyecto Angular (E1.3)

## Cómo se creó

```bash
ng new optinova-web --style=css --ssr=false --routing --skip-git --package-manager=npm
```
Es el equivalente a `flutter create`. Genera Angular 22 con componentes standalone, **zoneless** (Angular redibuja solo cuando cambia un signal) y tests con **Vitest**.

Después se agregaron:
- **Tailwind CSS v4** (`tailwindcss`, `@tailwindcss/postcss`, `.postcssrc.json`): clases como `flex`, `p-4`, `bg-primary`.
- **`@angular/cdk` + `@angular/aria`**: comportamiento sin estilo (diálogos, menús, combobox) para nuestros propios componentes.

## Carpetas y archivos

```
optinova-web/
├── node_modules/        librerías descargadas
├── public/              archivos estáticos
├── src/                 TU CÓDIGO
│   ├── index.html       la única página HTML
│   ├── main.ts          punto de arranque
│   ├── styles.css       estilos globales + tokens
│   └── app/
│       ├── app.ts            componente raíz (lógica)
│       ├── app.html          componente raíz (lo que se ve)
│       ├── app.css           estilos solo de este componente
│       ├── app.spec.ts       test
│       ├── app.config.ts     configuración global
│       └── app.routes.ts     rutas
├── package.json         dependencias
├── angular.json         configuración de compilación
└── tsconfig*.json       reglas de TypeScript
```

| Angular | En Flutter es… | Para qué sirve |
|---|---|---|
| `node_modules/` | `.dart_tool/` + caché de pub | Librerías descargadas. Nunca se edita ni se sube a git; se regenera con `npm install`. |
| `public/` | `assets/` | Imágenes, íconos, favicon. Se copian tal cual. |
| `src/` | `lib/` | Todo tu código. |
| `src/index.html` | `web/index.html` | Única página HTML. Angular pinta la app dentro de `<app-root>`. |
| `src/main.ts` | `main.dart` | `bootstrapApplication(App)` = `runApp(MyApp())`. |
| `src/styles.css` | `ThemeData` global | Estilos de toda la app. Importa Tailwind y define los tokens (colores). |
| `app/app.ts` | Clase de `MyApp` | Lógica: signals y métodos. |
| `app/app.html` | El `build()` | Lo que se ve. Angular separa lógica (`.ts`) y vista (`.html`). |
| `app/app.css` | Estilo de un solo widget | Estilos que solo afectan a ese componente. |
| `app/app.spec.ts` | `test/widget_test.dart` | Test; se corre con `ng test`. |
| `app/app.config.ts` | `ProviderScope` + setup de `main()` | Registra servicios globales (router, etc.). |
| `app/app.routes.ts` | Lista de `GoRoute` | Rutas. |
| `package.json` | `pubspec.yaml` | Nombre, scripts y dependencias. |
| `package-lock.json` | `pubspec.lock` | Versiones exactas. Sí va a git. |
| `angular.json` | Configuración de `flutter build` | Cómo compilar, límites de tamaño (budgets). |
| `tsconfig*.json` | `analysis_options.yaml` | Qué tan estricto es TypeScript. |
| `.postcssrc.json` | — | Conecta Tailwind con el compilador. |
| `.editorconfig` / `.prettierrc` | `dart format` | Reglas de formato. |
| `dist/` (al compilar) | `build/web/` | App lista para publicar; ignorada en git. |

## El primer componente (`app.ts` + `app.html`)

```ts
protected readonly clicks = signal(0);          // = StateProvider<int>((ref) => 0)
protected addClick() {
  this.clicks.update((c) => c + 1);              // = ref.read(p.notifier).state++
}
```
```html
<p>Clics: {{ clicks() }}</p>                      <!-- = Text('Clics: ${ref.watch(p)}') -->
<button (click)="addClick()">Púlsame</button>    <!-- = onPressed: addClick -->
```
- `{{ }}` muestra un valor, como `${}` dentro de un `Text`.
- `(click)="..."` escucha un evento, como `onPressed`.
- Leer `clicks()` en el HTML suscribe la vista: cuando el signal cambia, Angular redibuja solo ese texto.

## Primario personalizable (adelanto de E1.5)

La idea: el color primario sale de una variable CSS y cambiarla en tiempo de ejecución re-colorea todo, como cambiar el `colorScheme` del `ThemeData`. La versión definitiva (escala completa, modo oscuro, densidad) está en [L01](01-tokens-y-tema.md).

## Por qué no PrimeNG

Al instalarlo apareció el aviso "Invalid PrimeUI License": desde 2026 PrimeNG requiere licencia (gratis solo para empresas pequeñas, con renovación anual). Se decidió construir un sistema de diseño propio sobre piezas oficiales de Angular. Ver `docs/design/`.

## Comandos

| Comando | Flutter | Qué hace |
|---|---|---|
| `npm install` | `flutter pub get` | Descarga dependencias |
| `npm start` / `ng serve` | `flutter run -d chrome` | Servidor con recarga en `localhost:4200` |
| `ng build` | `flutter build web` | Compila a `dist/` |
| `ng test --watch=false` | `flutter test` | Corre los tests |
