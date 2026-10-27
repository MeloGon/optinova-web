# F07: Recorrido guiado de E2.1: login, sesión, guards y roles

**Idea central:** E2.1 reparte el trabajo entre modelos, repositorio, sesión, navegación y vista. Es la arquitectura que ya conoces de Flutter: los widgets muestran el estado del Notifier y el repositorio se ocupa de Supabase.

Solo teoría con ejemplos, sin ejercicios. Lectura por bloques, de adentro hacia afuera. Los fragmentos son del código actual o extractos identificados; las analogías Dart explican responsabilidades, no copian la app Flutter original.

Esta lección reúne conceptos de TypeScript, plantillas, signals e inyección. F04–F06 siguen siendo lecturas complementarias pendientes; preparar F07 no las da por completadas.

## 1. Los datos: role.ts y profile.ts

Rutas: `src/app/core/models/role.ts` y `src/app/core/models/profile.ts`.

### 1.1 Una lista y un tipo cumplen trabajos diferentes

```ts
export const ROLES = [
  'vendedor', 'supervisor', 'admin', 'megadmin',
] as const;
export type Role = (typeof ROLES)[number];
```

`ROLES` es una lista que existe al ejecutar JavaScript. Su orden expresa la jerarquía del proyecto. `as const` conserva los valores literales y la trata como una tupla de solo lectura al comprobar tipos.

`typeof ROLES` obtiene el tipo de esa lista; `[number]` obtiene el tipo de sus elementos. El resultado de `Role` equivale a escribir `'vendedor' | 'supervisor' | 'admin' | 'megadmin'`. Así, la lista y el tipo salen de la misma definición. La palabra `export` permite importarlos desde otros archivos.

En Dart podrías pensar en un enum junto a una lista ordenada de sus valores. Aquí el rol sigue siendo un string, compatible con lo que guarda `perfiles.rol`.

### 1.2 Por qué hasRole sustituye varias comprobaciones

```ts
export const hasRole = (role: Role, min: Role): boolean =>
  ROLES.indexOf(role) >= ROLES.indexOf(min);
```

`indexOf` devuelve la posición: vendedor 0, supervisor 1, admin 2 y megadmin 3. `hasRole` pregunta si el rol alcanza **al menos** el nivel requerido.

| Pregunta de permisos | Expresión con la jerarquía |
|---|---|
| Acceso de admin o superior | `hasRole(role, 'admin')` |
| Acceso de supervisor o superior | `hasRole(role, 'supervisor')` |
| Acceso de megadmin | `hasRole(role, 'megadmin')` |
| Cualquier rol reconocido | `hasRole(role, 'vendedor')` |

Por ejemplo, `hasRole('admin', 'supervisor')` es `true`; `hasRole('supervisor', 'admin')` es `false`.

Al venir de getters como `isAdmin`, `adminOrSupervisor` e `isMegaadmin`, la ventaja es concentrar la regla en una sola función. Cada ruta y cada opción del menú declara el mínimo que necesita, sin repetir listas de roles admitidos. Un megadmin hereda el acceso de admin y supervisor porque ocupa una posición superior.

La equivalencia depende de la intención del getter anterior: si `isAdmin` quería decir «exactamente admin», entonces corresponde `role === 'admin'`. Si `adminOrSupervisor` excluía expresamente a megadmin, tampoco equivale a un mínimo. `hasRole` reemplaza las preguntas de acceso jerárquico de este proyecto, no toda comparación imaginable de roles. Esta jerarquía tampoco expresa permisos independientes entre sí.

Una analogía Dart, con el mismo orden, sería:

```dart
enum Role { vendedor, supervisor, admin, megadmin }
bool hasRole(Role role, Role min) => role.index >= min.index;
```

### 1.3 Profile es el dato de la sesión

```ts
export interface Profile {
  id: string;
  name: string;
  branch: string;
  role: Role;
  email: string;
}
```

Es el equivalente de un `ProfileModel`: agrupa los datos que usarán la sesión y la interfaz. `branch` es texto que viene de los datos, no un enum de sucursales escrito en la vista.

La interfaz describe la forma del objeto, pero no genera constructor, `fromJson` ni validación. Tampoco es el usuario completo de Supabase Auth: nombre, sucursal y rol se leen de `perfiles`; el correo se obtiene del usuario autenticado. La implementación del repositorio une esos datos.

## 2. El contrato: auth.repository.ts y app.config.ts

Rutas: `src/app/core/repositories/auth.repository.ts` y `src/app/app.config.ts`.

### 2.1 El store pide una capacidad, no una librería

El contrato declara cuatro operaciones. Estos son sus tipos, abreviando el cuerpo de la clase:

```ts
abstract signIn(email: string, password: string):
  Promise<Result<Profile, AppError>>;
abstract restoreSession(): Promise<Profile | null>;
abstract signOut(): Promise<void>;
abstract onSignedOut(callback: () => void): void;
```

`abstract` obliga a la implementación a proporcionar esas operaciones. `Promise<T>` ocupa el lugar de `Future<T>`; `Result<Profile, AppError>` se parece a `Either<AppError, Profile>` de fpdart.

En `core/result.ts`, `Result` distingue `{ ok: true, value }` y `{ ok: false, error }`. Por eso el consumidor comprueba `result.ok` antes de leer el valor o el error. `ok(...)` y `err(...)` cumplen la función de `Right(...)` y `Left(...)`.

Los cuatro métodos no tienen la misma política de resultado: iniciar sesión devuelve un `Result`; restaurar devuelve perfil o `null`; salir devuelve una promesa sin valor; suscribirse a una salida recibe un callback. Leer la firma de cada método evita suponer que todos devuelven un `Result`.

### 2.2 Dónde se elige Supabase

En los `providers` de `appConfig` aparece:

```ts
{ provide: AuthRepository, useClass: SupabaseAuthRepository }
```

Se lee: «cuando alguien pida `AuthRepository`, resuelve esa dependencia usando `SupabaseAuthRepository`». Por eso `inject(AuthRepository)` puede aparecer en el store sin que este importe la implementación.

Como comparación conceptual con Riverpod:

```dart
final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => SupabaseAuthRepository(),
);
```

`inject` obtiene una dependencia; no observa por sí mismo sus cambios como `ref.watch`. La reactividad llegará al leer signals. Se utiliza una clase abstracta como identificador porque existe en ejecución; una interfaz TypeScript se elimina y no puede servir sola como token.

Esta conexión permite reemplazar la implementación en el futuro manteniendo el contrato. Además, `app.config.ts` registra el router, el tema y la restauración inicial de sesión. La restauración se explica después de conocer `SessionStore`. [Referencia: proveedores de Angular](https://angular.dev/guide/di/defining-dependency-providers).

## 3. El acceso real: supabase-auth.repository.ts

Ruta: `src/app/core/data/supabase-auth.repository.ts`.

### 3.1 Del contrato al cliente

La clase lleva `@Injectable()`, extiende `AuthRepository` e inyecta `SUPABASE`. Este token, definido en `core/supabase/supabase.client.ts`, crea el cliente compartido. Equivale funcionalmente a obtener `Supabase.instance.client`, pero queda dentro de la capa de datos.

El recorrido de `signIn` es concreto: llama a `auth.signInWithPassword`, traduce un posible error y, si las credenciales funcionan, carga el perfil. Si falla esa carga, solicita cerrar la sesión de Supabase y devuelve el error del perfil. Autenticarse y disponer de un perfil utilizable son pasos distintos.

### 3.2 De la fila de base de datos al modelo de la app

`ProfileRow` describe la fila con nombres originales: `id`, `nombre`, `sucursal` y `rol`. Los tres últimos pueden ser nulos. El método privado `loadProfile(user)` consulta:

```ts
const { data, error } = await this.supabase
  .from('perfiles')
  .select('id, nombre, sucursal, rol')
  .eq('id', user.id)
  .maybeSingle<ProfileRow>();
```

`eq` filtra por el identificador del usuario. `maybeSingle` permite obtener una fila o ninguna; los errores de la consulta se convierten a `AppError`. Si no hay fila, el repositorio devuelve el mensaje «Tu usuario no tiene perfil. Pide ayuda a tu administrador.».

Después construye el objeto de la aplicación:

```ts
return ok({
  id: data.id,
  name: data.nombre ?? user.email ?? '',
  branch: data.sucursal ?? '',
  role: toRole(data.rol),
  email: user.email ?? '',
});
```

Se parece al paso datasource/modelo de datos hacia modelo de dominio en Flutter. `??` usa el siguiente valor solo cuando el anterior es `null` o `undefined`; una cadena vacía sigue siendo un valor presente.

El genérico `<ProfileRow>` ayuda al compilador a describir la respuesta; no instala un validador completo en ejecución. Para el rol sí hay una comprobación explícita: `toRole` usa `ROLES.includes(...)`. Un valor desconocido o nulo termina como `'vendedor'`, el nivel más bajo. `as Role` es una indicación al compilador; la comprobación real la hace `includes`.

### 3.3 Restauración, salida y mensajes

`restoreSession` llama a `auth.getSession()`, toma `data.session?.user` y, si existe, vuelve a consultar su perfil. Devuelve `null` si falta usuario o si la carga de perfil devuelve un error. Por eso una restauración fallida de perfil no tiene el mismo mensaje visible que un envío fallido del formulario.

`getSession` obtiene la sesión del almacenamiento que administra el SDK y puede renovarla si hace falta. No equivale a consultar siempre el usuario al servidor; el control real de acceso a los datos corresponde al backend. [Referencia: getSession](https://supabase.com/docs/reference/javascript/auth-getsession).

`signOut` delega en el SDK. `onSignedOut` escucha `onAuthStateChange` y solo invoca el callback ante `SIGNED_OUT`; no reacciona a todos los eventos actualizando el perfil. El contrato actual no devuelve una función para cancelar esa escucha, y la sesión que lo usa vive a nivel de aplicación. [Referencia: eventos de autenticación](https://supabase.com/docs/reference/javascript/auth-onauthstatechange).

`authError` traduce casos concretos, como credenciales inválidas, correo no confirmado o demasiados intentos. También reconoce `AuthRetryableFetchError` para mostrar el mensaje de conexión. Los demás casos pasan por `toAppError`. El store recibe mensajes preparados para la UI, sin depender de códigos propios de Supabase.

## 4. La sesión compartida: session.store.ts

Ruta: `src/app/core/auth/session.store.ts`.

### 4.1 Un estado privado y lecturas públicas

```ts
@Injectable({ providedIn: 'root' })
export class SessionStore {
  // Fragmento del estado:
  private readonly state = signal<Profile | null>(null);
  readonly profile = this.state.asReadonly();
  readonly isAuthenticated = computed(() => this.state() !== null);
}
```

Este extracto omite los otros miembros para centrarse en el estado. `providedIn: 'root'` da a la sesión alcance de aplicación: recuerda a un provider `keepAlive`. No se destruye al salir de la página de login.

`signal` guarda un valor reactivo; `state()` lo lee y `state.set(...)` lo cambia. `asReadonly()` expone lectura sin los métodos `set` y `update`; no vuelve profundamente inmutable el objeto `Profile`. `computed` deriva un valor del estado: aquí, si hay perfil. No necesita almacenar otro booleano manualmente.

La analogía Riverpod sería mantener un `Profile?` y derivar la autenticación al observarlo. En Angular, los consumidores reactivos registran la dependencia al leer el signal. [Referencia: signals](https://angular.dev/guide/signals).

### 4.2 Las operaciones que cambian la sesión

| Método | Qué hace el código actual |
|---|---|
| `restore()` | Espera al repositorio y guarda perfil o `null` |
| `login(email, password)` | Solicita iniciar sesión; guarda el perfil solo si el Result es exitoso y devuelve ese Result |
| `logout()` | Borra el perfil local, espera el cierre en el repositorio y navega al login |
| `can(min)` | Devuelve false sin perfil; con perfil delega en hasRole |

El constructor registra el callback de salida. Si llega `SIGNED_OUT` y había perfil, lo borra y navega a `/auth/login`. Si ya estaba vacío, retorna. Durante `logout()`, esto evita repetir desde el callback la navegación que el propio método hará después.

`can('admin')` combina dos preguntas: «¿hay perfil?» y «¿alcanza el nivel?». La función `hasRole` solo compara roles; `SessionStore.can` la aplica al usuario actual.

### 4.3 El splash y app.config.ts

La conexión de arranque es:

```ts
provideAppInitializer(() => inject(SessionStore).restore())
```

El callback devuelve la promesa de `restore`, y Angular espera su finalización para completar la inicialización. Mientras arranca, `src/index.html` contiene un spinner dentro de `<app-root>`; Angular sustituye ese contenido al montar la aplicación.

Esto cumple el propósito de un splash con `AuthStatus.checking` en Flutter, pero el store no necesita guardar ese estado: la espera ocurre durante el arranque. Con la configuración actual, la sesión queda restaurada para la navegación inicial. La persistencia del token la administra Supabase; el signal vuelve a crearse al recargar y se rellena mediante la restauración. [Referencia: provideAppInitializer](https://angular.dev/api/core/provideAppInitializer).

## 5. La entrada a cada página: guards.ts y app.routes.ts

Rutas: `src/app/core/auth/guards.ts` y `src/app/app.routes.ts`.

### 5.1 Tres preguntas para el router

| Guard | Deja pasar cuando… | Destino alternativo |
|---|---|---|
| `authGuard` | Existe perfil autenticado | `/auth/login` |
| `guestGuard` | No hay sesión | `/dashboard` |
| `roleGuard(min)` | `session.can(min)` es true | `/dashboard` |

Un guard es una función de tipo `CanActivateFn`. En estos archivos devuelve `true` o un `UrlTree`, la representación de una URL que crea `router.parseUrl(...)`. No devuelve un string como suele hacerlo `redirect` de go_router.

```ts
return session.isAuthenticated()
  || inject(Router).parseUrl('/auth/login');
```

El operador `||` devuelve el primer operando si es verdadero; si es falso, evalúa y devuelve el segundo. Este fragmento de `authGuard` devuelve `true` o el árbol de URL. No inicia una navegación aparte dentro del guard: entrega la decisión al router.

`roleGuard` es una función que fabrica otra función:

```ts
export const roleGuard =
  (min: Role): CanActivateFn =>
  () => inject(SessionStore).can(min)
    || inject(Router).parseUrl('/dashboard');
```

`roleGuard('admin')` prepara un guard que recuerda ese mínimo y lo comprobará al ejecutarse. La primera llamada configura; la segunda toma la decisión usando la sesión actual.

### 5.2 Cómo se conectan a las rutas

La raíz redirige a `dashboard`. La ruta padre `auth` usa `guestGuard` y aloja a `login`; la ruta padre `dashboard` usa `authGuard` y aloja las páginas internas. Los layouts cumplen el papel de un `ShellRoute`: muestran un marco y un `<router-outlet>` para el contenido hijo. Esto no implica conservar varias pilas de navegación como un `StatefulShellRoute` de go_router.

Las rutas usan `loadComponent` con `import(...)`: cargan el componente de manera diferida. La función auxiliar `pending` construye rutas para páginas todavía en desarrollo y agrega `roleGuard(data.minRole)` si los datos declaran un mínimo.

| Ruta bajo dashboard | Mínimo |
|---|---|
| Dashboard, buscar/agregar paciente, vender, historial y egresos | Sesión; acceso base de vendedor |
| `settings/payments-report` | supervisor |
| `settings/resins`, `settings/mounts` | admin |
| `settings/sales-by-seller`, `settings/features`, `settings/audit-logs` | admin |
| `settings/users-management` | megadmin |

`expenses` es la página base «Egresos»; `settings/payments-report` es el reporte «Ingresos y egresos». Aunque comparten palabras, tienen requisitos distintos.

Por ejemplo, un vendedor que escribe la URL de resinas encuentra el guard de rol y regresa al dashboard. Sin sesión, entrar al dashboard activa la redirección al login. Una sesión existente que intenta entrar a login encuentra `guestGuard`.

Los guards deciden la navegación del cliente cuando el router los ejecuta. No son una suscripción permanente a cambios de rol ni sustituyen las reglas RLS del backend. [Referencia: guards de Angular](https://angular.dev/guide/routing/route-guards).

## 6. El estado de la pantalla: login.store.ts

Ruta: `src/app/features/login/login.store.ts`.

`LoginState` contiene `loading` y `error`. A partir del signal privado, `computed` expone ambos campos para la plantilla. A diferencia de `SessionStore`, la clase solo lleva `@Injectable()`: su alcance se define en la página mediante `providers: [LoginStore]`.

La comparación útil es un Notifier dedicado al login con duración ligada a esa pantalla. La inyección por componente no replica todas las reglas de `autoDispose`, pero aquí permite crear y destruir el store junto al componente.

Al ejecutar `submit(email, password)`, el store activa la carga, limpia el error y llama a `session.login(email.trim(), password)`. Recorta espacios del correo, no de la contraseña. Si funciona, espera la navegación a `/dashboard`; si falla, apaga la carga y muestra `result.error.message`.

No apaga `loading` en la rama exitosa: el flujo normal abandona y destruye la página. La explicación describe lo que hace el código actual, sin añadir un `finally` que no existe. Tampoco hay un `try/catch` general en este store; el camino de error mostrado es el `Result` devuelto por la sesión.

`clearError` conserva el resto del estado y borra el mensaje:

```ts
this.state.update((s) => ({ ...s, error: null }));
```

Recuerda a `state = state.copyWith(error: null)`. Los valores escritos del formulario pertenecen a la página; el perfil autenticado pertenece a la sesión; carga y error de la petición pertenecen a `LoginStore`.

## 7. La vista y el formulario: login.page.ts

Ruta: `src/app/features/login/login.page.ts`.

### 7.1 La configuración del componente

`@Component` conecta la clase con `login.page.html`, declara las dependencias de plantilla y provee el store. `imports: [ReactiveFormsModule, LucideDynamicIcon]` permite usar el formulario reactivo y los iconos. Importar `ReactiveFormsModule` oficial no convierte esta aplicación en una arquitectura de NgModules: la página sigue siendo un componente standalone.

`protected readonly store = inject(LoginStore)` obtiene el store local para usarlo desde la clase y la plantilla. `host` aplica clases al elemento que representa la página.

### 7.2 FormGroup y FormControl

Extracto del grupo real:

```ts
protected readonly form = new FormGroup({
  email: new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email],
  }),
  password: new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(6)],
  }),
});
```

Cada control mantiene valor y estado de validación; el grupo reúne ambos. La comparación Flutter combina las tareas de `TextEditingController`, validadores y `FormState`.

`nonNullable` mantiene el valor del control como string y hace que un reset sin valor vuelva al inicial. No significa «campo obligatorio»: eso lo comprueba `Validators.required`. El correo tiene además una regla de formato; la contraseña tiene longitud mínima. Son validaciones locales previas a la autenticación. [Referencia: formularios reactivos](https://angular.dev/guide/forms/reactive-forms).

### 7.3 Cuándo mostrar errores y cuándo enviar

`showPassword` y `submitted` son signals locales: describen detalles de interacción. `emailError()` y `passwordError()` devuelven mensajes cuando hubo un intento de envío **o** el campo está `touched`, normalmente después de perder el foco. Aunque un comentario del archivo resume «después del primer intento», la condición también permite mostrarlos al tocar el campo.

`onSubmit()` activa `submitted`, retorna si el formulario es inválido o ya hay una petición en curso, obtiene los valores con `getRawValue()` y los entrega al store. Es el papel de validar el `Form` antes de llamar al Notifier. La página no usa el cliente Supabase.

## 8. Lo que se dibuja: login.page.html

Ruta: `src/app/features/login/login.page.html`.

La clase anterior es la parte de datos y callbacks de la vista; la plantilla ocupa el lugar del árbol que escribirías en `build()`.

```html
<form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
  <!-- Extracto: el original incluye todos los campos y estilos. -->
</form>
```

`[formGroup]` conecta el grupo de la clase con el formulario; `formControlName="email"` y `formControlName="password"` conectan cada entrada. `(ngSubmit)` llama al método de la página. `novalidate` deja la presentación del error a la lógica de Angular, evitando el diálogo nativo de validación del navegador.

### 8.1 Leer las vinculaciones

| Vinculación o expresión real | Cómo leerlo desde Flutter |
|---|---|
| `[type]` según `showPassword()` | Elegir text o password, parecido a cambiar obscureText |
| `showPassword.update((v) => !v)` | El callback de click invierte el booleano |
| `(input)="store.clearError()"` | Limpiar el error de la petición al editar |
| `[disabled]="store.loading()"` | Deshabilitar el envío mientras se espera |
| `{{ e }}` | Mostrar un texto procedente del estado |

El botón del ojo usa `type="button"`, por lo que no envía el formulario. `label` se asocia al campo por `for` e `id`; los atributos `aria-*` comunican estado y descripción a tecnologías de asistencia. Las clases Tailwind se ocupan del aspecto visual y no autentican al usuario.

### 8.2 @if y los estados visibles

```html
@if (store.error(); as e) {
  <div role="alert">{{ e }}</div>
}
```

Este extracto omite icono y estilos. `as e` da un nombre local al mensaje para usarlo dentro del bloque. Los errores de campo se presentan de manera parecida con `emailError()` y `passwordError()`.

El botón de envío muestra «Ingresando…» y un spinner cuando `loading()` es true; de lo contrario, muestra «Ingresar». Recuerda a elegir widgets según el estado observado con Riverpod. Borrar el error del servidor no borra el correo ni la contraseña: son estados distintos.

## 9. El resultado visible: dashboard-nav.ts y topbar.ts

Rutas: `src/app/layouts/dashboard-layout/dashboard-nav.ts` y `src/app/shared/ui/topbar/topbar.ts`. Los archivos `dashboard-layout.ts`, `dashboard-layout.html` y `topbar.html` muestran cómo se conectan.

### 9.1 El menú describe opciones y mínimos

`DASHBOARD_NAV` es una lista de secciones. Cada opción declara etiqueta, icono, ruta y `minRole`. Es una configuración de datos, parecida a una lista de destinos con permisos en Flutter.

El filtrado no ocurre en ese archivo de datos. Lo hace el `computed` llamado `nav` en `DashboardLayout`: lee el perfil, recorre las secciones con `map`, filtra sus opciones mediante `session.can(item.minRole)` y elimina las secciones vacías. `filter` corresponde a `where(...).toList()` de Dart. La lectura del perfil conecta el cálculo con los cambios de sesión.

Con la configuración actual quedan 6 opciones para vendedor, 7 para supervisor, 12 para admin y 13 para megadmin. Ocultar opciones facilita el uso; los guards controlan también la navegación por URL. `dashboard-nav.spec.ts` comprueba que cada destino del menú exista y tenga el mismo mínimo que su ruta, usando vendedor como valor base.

### 9.2 Topbar recibe datos y emite intenciones

`Topbar` declara `input` para título, descripción, sucursal, nombre y rol. `title` es obligatorio; los demás pueden faltar. También declara `output<void>()` para abrir el menú y cerrar sesión: notifica la acción sin enviar un dato adicional.

El layout la conecta así, en un extracto de su plantilla:

```html
<onv-topbar [title]="page().title"
  [branch]="session.profile()?.branch"
  [userName]="session.profile()?.name" [userRole]="roleLabel()"
  (logout)="session.logout()" />
```

Recuerda a pasar propiedades y un `VoidCallback` a un widget. `?.` devuelve `undefined` si falta perfil. `roleLabel()` transforma el código del rol en su etiqueta visible mediante un mapa; `page()` obtiene los datos de la ruta activa. La topbar no decide permisos ni llama directamente a autenticación.

Su `computed initials` divide el nombre en palabras, toma como máximo dos y une sus iniciales en mayúscula. Depende del input `userName()`, por lo que se recalcula cuando cambia. Para el tema sí inyecta `ThemeService`, una responsabilidad visual diferente de la sesión.

### 9.3 Cerrar sesión desde el menú

`topbar.html` conecta un botón con una plantilla `ng-template` usando `cdkMenuTriggerFor`. Dentro, `cdkMenu` y `cdkMenuItem` aportan el comportamiento de menú; el aspecto visual lo ponen las clases del proyecto. Es el propósito que cumpliría un `PopupMenuButton` en Flutter.

Al recibir `cdkMenuItemTriggered`, la plantilla llama a `logout.emit()`. El layout escucha ese output y ejecuta `session.logout()`. La sesión borra el perfil local, delega el cierre al repositorio y navega al login. `authGuard` vuelve a bloquear el acceso al dashboard sin sesión.

## 10. Seguir una acción completa

Después de recorrer los archivos de adentro hacia afuera, podemos leer el viaje de una pulsación en el sentido contrario:

```text
login.page.html: envío del formulario
  login.page.ts: validar y obtener valores
    LoginStore: activar carga y llamar a la sesión
      SessionStore: pedir autenticación al contrato
        AuthRepository -> SupabaseAuthRepository
          Supabase Auth + consulta de perfiles
```

El resultado vuelve por esas capas. Si es exitoso, la sesión guarda el perfil y `LoginStore` navega al dashboard. El layout usa el mismo perfil para filtrar el menú y alimentar la topbar. Si el repositorio devuelve un error, el store lo convierte en estado visible de la página.

Al recargar, el viaje empieza en el inicializador: repositorio, perfil, signal de sesión y decisión del router. Al cerrar sesión, empieza en un output de la topbar y termina de nuevo en el login.

Esta separación permite ubicar cada pregunta: los modelos describen datos; el repositorio habla con Supabase; la sesión conserva al usuario; los guards deciden el acceso de navegación; el store de login coordina la petición; la página y sus controles muestran el estado y recogen acciones.
