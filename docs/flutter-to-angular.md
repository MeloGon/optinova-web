# Glosario Flutter → Angular

Crece con cada entregable. Columna izquierda: lo que ya sabes. Derecha: su equivalente aquí.

## Herramientas

| Flutter / Dart | Web / Angular |
|---|---|
| Herramientas ejecutadas con el Dart SDK | Node.js ejecuta herramientas; TypeScript llega como paquete separado |
| `fvm` | `fnm` / `nvm` |
| `pub` | `npm` |
| `pubspec.yaml` | `package.json` |
| `pubspec.lock` | `package-lock.json` |
| Paquetes descargados por pub | `node_modules/` (paquetes locales; no equivale exactamente a `.dart_tool/`) |
| `flutter` CLI | `ng` (Angular CLI) |
| `flutter pub get` | `npm install` |
| `flutter run -d chrome` | `ng serve` (localhost:4200) |
| `flutter build web` | `ng build` |
| `build_runner` (codegen) | no hace falta: TS no necesita generar código para modelos |
| `--dart-define` / `flutter_dotenv` / flavors | `src/environments/` + `fileReplacements` en `angular.json` |

## UI

| Flutter | Angular |
|---|---|
| Widget | Component (clase TS + template HTML + estilos) |
| `build()` | `template` del componente |
| Parámetros del constructor del widget | `input()` |
| Callback `onPressed`, `onChanged` | `output()` / `(click)="..."` |
| `Row` | `flex` (Tailwind) |
| `Column` | `flex flex-col` |
| `Column(spacing: 16)` | `flex flex-col gap-4` |
| `mainAxisAlignment: spaceBetween` | `justify-between` |
| `crossAxisAlignment: center` | `items-center` |
| `Expanded` | `flex-1` |
| `Padding(EdgeInsets.all(16))` | `p-4` |
| `SizedBox(width: 200)` | `w-[200px]` |
| `MediaQuery` / responsive | prefijos `sm:` `md:` `lg:` |
| `if (x) Widget()` dentro de children | `@if (x) { ... }` |
| `ListView.builder` / `.map()` | `@for (item of items; track item.id) { ... }` |
| shadcn_ui | Componentes propios en `shared/ui/` (Tailwind + CDK/Aria) |
| `GestureDetector` / `Overlay` / `Focus` (comportamiento sin estilo) | `@angular/cdk` y `@angular/aria` (headless) |
| `ThemeData` / `ColorScheme` | tokens en `styles.css` (`@theme`) como variables CSS |
| `colorScheme.primary` / `onPrimary` | `bg-primary` / `text-primary-foreground` |
| `darkTheme` + `ThemeMode` | `data-theme="dark"` en `<html>` redefine los tokens; `ThemeService.setMode()` |
| `ColorScheme.fromSeed(seedColor:)` | `applyPrimary(hex)` (`core/theme/primary-scale.ts`) |
| `VisualDensity` | `data-density="compact"` + variables `--onv-*` |
| `MediaQuery.platformBrightnessOf` | `matchMedia('(prefers-color-scheme: dark)')` |
| `SharedPreferences` | `localStorage` |
| `textTheme.titleMedium` | `text-heading` (escala T-02) |

## Estado (Riverpod → signals)

| Riverpod | Angular |
|---|---|
| `StateProvider` / `ValueNotifier` | `signal(valor)` |
| leer `state` | `miSignal()` |
| `state = x` | `miSignal.set(x)` |
| `state = state.copyWith(...)` | `miSignal.update(s => ({ ...s, campo: x }))` |
| Provider que hace `watch` de otro | `computed(() => ...)` |
| `ref.listen` | `effect(() => ...)` |
| `Notifier` (viewmodel) | Service `@Injectable()` con signals = "store" |
| `ref.read(provider)` / `ref.watch` | `inject(Servicio)` |
| `ref.watch` en `build` (redibuja) | leer el signal en el template |
| provider `autoDispose` | `providers: [Store]` en el componente |
| provider `keepAlive` / global | `@Injectable({ providedIn: 'root' })` |
| `Future` | `Promise` |
| `Stream` | `Observable` (RxJS) |

## Datos y arquitectura

| Flutter | Angular |
|---|---|
| clase freezed | `interface` / `type` + spread `{...}` |
| `fromJson`/`toJson` (json_serializable) | JSON se convierte a objetos JS; una interfaz no valida ni transforma sus datos |
| fpdart `Either<L, R>` | `Result<T, E>` propio (`core/result.ts`) |
| `Right(x)` / `Left(f)` / `fold` | `ok(x)` / `err(f)` / `if (r.ok) … else …` |
| `sealed class Failure` (freezed) | `AppError` con `kind: 'server' \| 'network' \| …` |
| `Supabase.instance.client` | `inject(SUPABASE)` (`InjectionToken`) |
| `Provider<T>((ref) => ...)` para algo que no es clase propia | `new InjectionToken<T>(..., { factory })` |
| `NumberFormat.currency(...)` | `{{ monto \| money }}` (`MoneyPipe`) |
| `enum` con valores | tipo unión de strings `'a' \| 'b'` o lista de `{ value, label }` |
| `group` / `test` / `expect(x, equals(y))` | `describe` / `it` / `expect(x).toBe(y)` |
| repo abstracto + impl | `abstract class` + `@Injectable` impl, registrada con `{ provide, useClass }` |
| `TextEditingController` + validators | Reactive Forms (`FormGroup`, `FormControl`, `Validators`) |
| go_router `routes` | `app.routes.ts` |
| `ShellRoute` + `child` | ruta con `children` + `<router-outlet />` en el layout |
| `initialLocation` / `errorBuilder` | `redirectTo` / ruta `'**'` |
| `state.extra` | `data` de la ruta → `input()` (`withComponentInputBinding`) |
| `currentPage == RouterName.x` (ítem activo) | `routerLinkActive` + `ariaCurrentWhenActive="page"` |
| `Stream` | `Observable` (RxJS); `toSignal()` lo convierte en signal |
| cancelar `StreamSubscription` en `dispose()` | `takeUntilDestroyed()` |
| `MediaQuery.of(context).size.width` | `BreakpointObserver` (CDK) + `toSignal` |
| `Scaffold` + `Row` + `Expanded` | `flex h-dvh` + `flex-1` |
| `Icons.search` | `LucideSearch` + `<svg [lucideIcon]>` (`@lucide/angular`) |
| go_router `redirect` | guard `canActivate` (`CanActivateFn`: devuelve `true` o una URL) |
| `AuthStatus.checking` + `SplashLayout` | `provideAppInitializer` + spinner dentro de `<app-root>` en `index.html` |
| `authProvider` (keepAlive) | `SessionStore` (`providedIn: 'root'`) |
| `GlobalKey<FormState>` / `validate()` | `FormGroup` / `form.invalid` |
| `Form` + `onFieldSubmitted` | `<form [formGroup] (ngSubmit)>` |
| mock de mocktail | clase falsa que extiende el repositorio abstracto (`FakeAuthRepository`) |
| `PopupMenuButton` | CDK Menu (`cdkMenuTriggerFor`, `cdkMenu`, `cdkMenuItem`) |
| `context.go('/x')` | `router.navigate(['/x'])` / `routerLink="/x"` |
| supabase_flutter | `@supabase/supabase-js` (API casi idéntica) |
| fl_chart | por decidir (Chart.js) |
| paquete `pdf` | pdfmake |
| `intl` `DateFormat` | `DatePipe` / `Intl.DateTimeFormat` |

## Fundamentos F00: herramientas y ejecución

Lectura: [F00: mapa del ecosistema web](lessons/fundamentos/F00-mapa-ecosistema-web.md).

| Flutter / Dart | Web / Angular |
|---|---|
| `flutter run -d chrome` | `npm start` ejecuta el script local `ng serve` |
| `flutter build web` y carpeta `build/web/` | `npm run build`, resultado en `dist/` según configuración |
| Compilar Dart para el destino web | Angular prepara TypeScript, plantillas y estilos para el navegador |
| Herramientas de desarrollo frente a aplicación publicada | Node ejecuta herramientas en tu computadora; el usuario abre la app en su navegador |

## Fundamentos F02: datos y lenguaje

Lectura: [F02: objetos y organización del código](lessons/fundamentos/F02-typescript-desde-dart-objetos.md).

| Flutter / Dart | TypeScript |
|---|---|
| `final` con objeto mutable | `const` impide reasignar la variable, no mutar el objeto |
| Modelo de datos | Objeto plano descrito por `interface` o `type`; no genera constructor |
| Campo `final` | Propiedad `readonly`, restricción de tipos; no congela el objeto en ejecución |
| `copyWith(name: 'Ana')` | `{ ...patient, name: 'Ana' }` para objetos planos; copia superficial |
| `String?` | `string \| null`; una propiedad `name?: string` además puede omitirse |
| Unión de freezed / jerarquía sellada | Unión discriminada mediante una propiedad literal como `status` |
| `T identity<T>(T value)` | `function identity<T>(value: T): T` |
| Importar nombres públicos de una biblioteca | Exportar con `export` e importar nombres con `import { ... }` |
| Tipos usados al analizar código | `import type` se elimina del JavaScript generado |
| `_campo`, privado de biblioteca | `private`, privado de clase al comprobar tipos; `#campo` ofrece privacidad en ejecución |
| `Future<T>` y `await` | `Promise<T>` y `await`; `async` no crea por sí solo otro hilo |

## Fundamentos F03: estructura HTML

Lectura: [F03: árbol de etiquetas](lessons/fundamentos/F03-html-arbol-etiquetas.md).

| Flutter | HTML / Angular |
|---|---|
| Árbol de widgets con `child` / `children` | Elementos anidados con padres e hijos; el navegador construye el DOM |
| `Text` | Texto en `p`, `span` o un encabezado según su significado |
| Etiqueta de un campo | `label` asociado al `input` mediante `for` e `id` |
| Botón con callback | `button type="button"`; `(click)` conecta la acción en Angular |
| Formulario con acción de guardar | `form` y `button type="submit"`; la lógica se conecta por separado |
| `Text(patientName)` | `{{ patientName }}`; si es signal, `{{ patientName() }}` |
| Propiedad booleana de un control | `[disabled]="saving"`; el atributo estático `disabled="false"` también deshabilita |

La comparación del árbol no implica que HTML use el mismo motor de diseño que Flutter. CSS y Tailwind definen la distribución visual; se desarrollan en F04.
