# Glosario Flutter → Angular

Crece con cada entregable. Columna izquierda: lo que ya sabes. Derecha: su equivalente aquí.

## Herramientas

| Flutter / Dart | Web / Angular |
|---|---|
| Dart SDK | Node.js (ejecuta las herramientas) |
| `fvm` | `fnm` / `nvm` |
| `pub` | `npm` |
| `pubspec.yaml` | `package.json` |
| `pubspec.lock` | `package-lock.json` |
| `.dart_tool/` | `node_modules/` |
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
| `fromJson`/`toJson` (json_serializable) | el JSON ya es un objeto JS; se tipa con la interfaz |
| fpdart `Either<L, R>` | `Result<T, E>` propio |
| repo abstracto + impl | `abstract class` + `@Injectable` impl, registrada con `{ provide, useClass }` |
| `TextEditingController` + validators | Reactive Forms (`FormGroup`, `FormControl`, `Validators`) |
| go_router `routes` | `app.routes.ts` |
| go_router `redirect` | guard `canActivate` |
| `context.go('/x')` | `router.navigate(['/x'])` / `routerLink="/x"` |
| supabase_flutter | `@supabase/supabase-js` (API casi idéntica) |
| fl_chart | por decidir (Chart.js) |
| paquete `pdf` | pdfmake |
| `intl` `DateFormat` | `DatePipe` / `Intl.DateTimeFormat` |
