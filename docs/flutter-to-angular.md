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

## Fundamentos F07: recorrido de E2.1

Lectura: [F07: login, sesión, guards y roles](lessons/fundamentos/F07-recorrido-e2-1.md).

| Flutter / Riverpod / go_router | Código actual de E2.1 |
|---|---|
| Enum de roles y comprobaciones de permisos | `Role` sale de `ROLES`; `hasRole(role, min)` compara posiciones en la jerarquía |
| Getters como `isAdmin`, `adminOrSupervisor`, `isMegaadmin` usados para acceso heredado | Mínimos `admin`, `supervisor`, `megadmin`; para igualdad exacta se conserva `role === ...` |
| `ProfileModel` | `Profile`; datos de `perfiles` más correo del usuario de Auth |
| Repositorio abstracto + provider de implementación | `AuthRepository` + `{ provide: AuthRepository, useClass: SupabaseAuthRepository }` en `app.config.ts` |
| `ref.read(repoProvider)` para obtener la dependencia | `inject(AuthRepository)`; obtener la instancia no suscribe por sí solo a cambios |
| Datasource y conversión de modelo | `loadProfile` transforma `ProfileRow` en `Profile`; `toRole` comprueba el rol con `ROLES.includes` |
| `Either<AppError, Profile>` | `Result<Profile, AppError>`; se distingue con `result.ok` |
| Provider de sesión con `keepAlive` | `SessionStore`, `providedIn: 'root'`; guarda `Profile \| null` |
| Lectura pública y cambios desde el Notifier | `state` privado, `profile = state.asReadonly()`; no implica inmutabilidad profunda |
| Valor derivado de un perfil observado | `computed` para `isAuthenticated`; `can(min)` consulta perfil y `hasRole` |
| Splash mientras se restaura la sesión | `provideAppInitializer` devuelve `restore()`; spinner inicial dentro de `app-root` |
| `redirect` de go_router | `CanActivateFn` devuelve `true` o `UrlTree` creado con `parseUrl` |
| Configurar una regla de acceso | `roleGuard('admin')` devuelve la función que comprobará la sesión actual |
| Marco de navegación de un `ShellRoute` | Ruta padre con layout, `children` y `router-outlet`; no implica varias pilas conservadas |
| Notifier del login con alcance de pantalla | `LoginStore`, provisto mediante `providers: [LoginStore]` en `LoginPage` |
| Controller, validación y `FormState` | `FormControl`, `Validators`, `FormGroup`; `nonNullable` no sustituye a `required` |
| `copyWith` para borrar un error | `state.update(s => ({ ...s, error: null }))` |
| `obscureText` y callback del ojo | `[type]` depende de `showPassword()`; el botón invierte ese signal |
| Lista de destinos visibles según permisos | `DASHBOARD_NAV` declara mínimos; `DashboardLayout.nav` filtra con `session.can` |
| Widget que recibe datos y un `VoidCallback` | Inputs de `Topbar` y output `logout`; el layout llama a `session.logout()` |
| `PopupMenuButton` | `cdkMenuTriggerFor`, `ng-template`, `cdkMenu` y `cdkMenuItemTriggered` |

El contrato distingue las operaciones: `signIn` devuelve `Result`, `restoreSession` devuelve perfil o `null`, `signOut` devuelve `Promise<void>` y `onSignedOut` registra un callback. El menú y los guards usan el mismo mínimo, pero las reglas de acceso a los datos se aplican en el backend.

## L05: búsqueda de pacientes y URL

Lectura: [buscar paciente](lessons/05-buscar-paciente.md).

| Flutter / Riverpod / go_router | Angular actual |
|---|---|
| SearchPatient Notifier | `SearchPatientStore`, provisto en la página |
| Controller de búsqueda | `FormControl text`, borrador hasta Enter o Buscar |
| Query parameters del router | Inputs `q`, `page`, `size` con `withComponentInputBinding` |
| Estado de filtros serializable | `computed search` normaliza la URL; filas y carga viven en el store |
| Cambiar offset y solicitar datos | Navegar con otra página; un effect vuelve a cargar |
| `where(...).toList()` | `filter(...)` |
| Resultado con `hasMore` en Flutter original | `Page<Patient>` con items y total exacto en Angular |
| Evitar aplicar respuestas antiguas | Contador `lastRequest`; descarta respuesta vieja sin cancelar la red |
| Widgets compartidos | Badge, Skeleton, EmptyState, Paginator, TableCard y directiva OnvTable |
| `showDialog` y Future con resultado | CDK Dialog, `DialogRef.closed` y `firstValueFrom` |
| `CustomSnackbar` | ToastService global y ToastOutlet del layout |
| Callback de guardado de un diálogo | Función `save` en `EditPatientDialogData`; si falla permanece abierto |

## L06: formulario de alta

Lectura: [agregar paciente](lessons/06-agregar-paciente.md).

| Flutter | Angular actual |
|---|---|
| Controller, validación y FormState | FormControl, Validators y FormGroup |
| Campo con decoración y etiqueta | `onv-field` recibe un control proyectado con `onvInput` |
| Widget que recibe child | `ng-content`; `contentChild` encuentra la directiva del control |
| Cancelar una escucha en dispose | `takeUntilDestroyed` en OnvInput |
| GenderToggle | Segmented con `ControlValueAccessor` y `formControlName` |
| Escuchar controllers con AnimatedBuilder | `valueChanges` convertido con `toSignal`, y `computed` para iniciales |
| Leer incluso un control bloqueado | `form.getRawValue()` incluye la sucursal deshabilitada |
| Aviso de posible homónimo | `findByName` y ConfirmService; no es restricción única |
| Modelo de entrada distinto del persistido | `NewPatient = Omit<Patient, 'id' \| 'registeredOn'>` |

El alta valida ambos teléfonos, pero permite vacío en el secundario. El editor no tiene exactamente las mismas reglas. El provider Flutter original de alta es keepAlive; el store Angular tiene alcance de página.

## L07: representación de los datos y evolución del esquema

Lectura: [IDs, fechas y columnas](lessons/07-base-de-datos-ids-fechas-columnas.md).

| Concepto conocido desde Dart / Flutter | Decisión del proyecto web |
|---|---|
| ID recibido como int | `Patient.id: string`; consulta `id::text` para evitar redondeo JavaScript |
| Generar ID aleatorio en el cliente | Secuencia PostgreSQL y default; el insert omite el ID |
| DateFormat para presentación | Fecha de negocio `date` en DB y string ISO en la app |
| Instante con hora | `timestamptz` para created_at/updated_at |
| Mapeo de modelo y JSON | `toPatient`/`toColumns` entre propiedades inglesas y columnas españolas |
| Migrar versión de base local | SQL versionado de PostgreSQL en supabase/migrations |
| Receta para convertir datos históricos | Documentos de supabase/transforms; conversión ejecutable dentro del SQL actual |

Un ID no es un contador de filas; una secuencia puede tener huecos. Convertir a string después de redondear no recupera precisión. Las futuras FK por ID y el borrado/archivo por historial siguen siendo entregables pendientes, separados del borrado básico disponible.

## L08: revisiones, diálogos y P-05 Graduación

Lectura: [revisiones y medidas](lessons/08-revisiones-medidas.md). Estado documentado: 2026-10-27; actualiza la situación de revisiones que L05–L07 describían como futura.

| Flutter / Riverpod | Angular actual |
|---|---|
| `ReviewModel` con medidas `String?` | `Review` con medidas `string`; el mapper transforma `NULL` en texto vacío |
| `getReviewsByPatient(patientName)` con `ilike` parcial | `getByPatient(patientId)` con igualdad de FK; el nombre histórico no es filtro alternativo |
| ID aleatorio en `addReview` | `NewReview = Omit<Review, 'id'>`; secuencia PostgreSQL de la migración #7 |
| `@JsonKey` y datasource | `toReview`/`toMeasureColumns`; propiedades inglesas y columnas españolas en `snake_case` |
| `Future<Either<Failure, ...>>` | `Promise<Result<..., AppError>>` en `ReviewRepository` |
| Notifier con banderas de apertura | Página que espera el resultado y abre CDK Dialog; store delega en el repo |
| Controllers del alta y controllers locales del editor | `createMeasureForm(initial?)`, compartido por ambos diálogos |
| Datos y callbacks por constructor de un widget | `DIALOG_DATA` con `patient`/`review`, `save`, `reload` o `remove` |
| `copyWith` de la revisión | `{ ...review, ...measureValues(form) }`; el update excluye paciente, sucursal y fecha |
| `showDialog<bool>` y su `Future` | `DialogRef.closed` y `firstValueFrom` para esperar el resultado |
| Aviso sin abrir cuando no hay medidas | Consulta previa, spinner de fila y toast; diálogo solo con resultados |
| Controllers, strings guardados y celdas `Text` sin formato numérico | P-05 `RxTable`: formato de lectura y normalización de captura separados |
| Tablas locales OD/OI | Componente compartido con modos `view`, `edit`, `compact`; controles del padre en edición |
| Texto negativo con guion, si así se escribió | Signo menos U+2212 al formatear; parser lo convierte a U+002D antes de `Number` |
| Sin atajo de centésimas en los diálogos consultados | `blur` de ESF/CIL interpreta `125` como `+1.25`; botones cambian ±0.25 |
| Etiquetas OD/OI en las tablas locales | OD relleno y OI delineado: forma y letras, sin depender solo del color |

Las medidas siguen almacenándose como texto. Formatear para leer no escribe en la DB; normalizar al capturar sí cambia el valor del control que se guardará. ADD y DIP siguen fuera de P-05 como valores únicos de la revisión; el atajo no está conectado a ADD. El PDF sustituye el menos tipográfico por un guion, según el generador del proyecto.

La FK está implementada en dev; los enlaces históricos ambiguos se revisan manualmente. En `2cbea08`, Claude corrigió los hallazgos iniciales: Agregar/Editar bloquean el envío con `measures.invalid`, EJE exige entero entre 0 y 180 y el detalle incluye LC, AV sin/con RX, CV e historia clínica. `RxTable` conecta `control.events` con un signal contador para actualizar errores en zoneless y cancela las suscripciones con `takeUntilDestroyed`, comparable a cancelar una escucha en `dispose`. S-03 con pestañas y el borrado/archivo del paciente con autorización siguen pendientes.
