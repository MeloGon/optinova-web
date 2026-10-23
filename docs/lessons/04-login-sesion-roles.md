# L04: Login, sesión, roles y guards (E2.1)

Primera feature real: se inicia sesión contra Supabase, la sesión sobrevive a recargar la página, el menú y las rutas dependen del rol y se puede cerrar sesión.

```
src/app/
  core/
    models/profile.ts                  Profile (= ProfileModel)
    repositories/auth.repository.ts    contrato (abstract class)
    data/supabase-auth.repository.ts   implementación con supabase-js
    auth/session.store.ts              sesión global (= authProvider)
    auth/guards.ts                     authGuard, guestGuard, roleGuard (= redirect)
  features/login/
    login.store.ts                     estado de la pantalla (= Login Notifier)
    login.page.ts / .html              formulario (= LoginView)
  testing/fake-auth.repository.ts      repositorio falso para tests
```

## Flujo (igual que en Flutter)

```
LoginPage → LoginStore → SessionStore → AuthRepository → SupabaseAuthRepository → supabase-js
```

## Primero, un arreglo de seguridad

Al revisar `perfiles` se encontró que la política **"own profile update"** dejaba que cualquier usuario con sesión cambiara su propia fila, incluido el `rol`. Bastaba con poner `rol = 'megadmin'` para usar la Edge Function `megadmin-users` y pasar la autorización de supervisor, porque ambas confían en `perfiles.rol`.

Se borró la política en dev y en prod (cambio #2 en `docs/db-changes.md`). Flutter no actualiza `perfiles` desde la app, así que no se rompió nada. Se probó en dev: el vendedor sigue leyendo su perfil, pero su intento de cambiarse el rol afecta 0 filas.

## Repositorio abstracto = `abstract class` + `{ provide, useClass }`

```ts
export abstract class AuthRepository {
  abstract signIn(email: string, password: string): Promise<Result<Profile, AppError>>;
  abstract restoreSession(): Promise<Profile | null>;
  abstract signOut(): Promise<void>;
  abstract onSignedOut(callback: () => void): void;
}
```

En `app.config.ts`:

```ts
{ provide: AuthRepository, useClass: SupabaseAuthRepository }
```

Es el `Provider<AuthRepository>((ref) => AuthRepositoryImpl(...))` de Riverpod. Quien hace `inject(AuthRepository)` recibe la implementación de Supabase; en los tests se cambia por `FakeAuthRepository` (= un mock de mocktail).

### Lo que hace la implementación de Supabase

- `signInWithPassword` y luego lee `perfiles` (`id, nombre, sucursal, rol`). Si no hay perfil, cierra la sesión y da un error claro.
- Traduce los errores de Supabase Auth al español: `invalid_credentials` → "Correo o contraseña incorrectos.", demasiados intentos, sin conexión…
- Un `rol` desconocido se trata como `vendedor` (el de menos permisos).
- El rol sale de `perfiles.rol`, como en Flutter. (`app_metadata.role` del JWT está vacío en todos los usuarios; anotado para la Fase 4.)

## `SessionStore` = `authProvider`

```ts
@Injectable({ providedIn: 'root' })   // keepAlive
export class SessionStore {
  private readonly state = signal<Profile | null>(null);
  readonly profile = this.state.asReadonly();
  readonly isAuthenticated = computed(() => this.state() !== null);

  async restore() { ... }   // al arrancar
  async login(email, password) { ... }
  async logout() { ... }
  can(min: Role) { ... }    // ¿tiene al menos este rol?
}
```

Diferencias con Flutter, a propósito:

| Flutter | Angular | Por qué |
|---|---|---|
| Guarda el token en `SharedPreferences` a mano | supabase-js guarda y renueva la sesión solo (en `localStorage`) | Flutter nunca revisaba si el token venció |
| Lee el perfil sin esperar (`_getUserData()` sin `await`) | Espera el perfil antes de entrar | En Flutter el primer login podía quedar sin nombre ni rol |
| Estado `checking` + pantalla Splash | `provideAppInitializer(() => session.restore())` | La sesión ya está lista antes de la primera ruta; no hace falta un estado intermedio |
| — | `onSignedOut` | Si la sesión termina sola (token vencido, salir en otra pestaña), vuelve al login |

### El splash

Mientras Angular arranca y restaura la sesión, se ve un círculo girando que está escrito directo en `index.html`, dentro de `<app-root>`. Cuando Angular pinta la primera pantalla, lo reemplaza. Es el `SplashLayout` sin necesidad de una ruta.

## Guards = `redirect` de go_router

```ts
export const authGuard: CanActivateFn = () =>
  inject(SessionStore).isAuthenticated() || inject(Router).parseUrl('/auth/login');
```

Un guard devuelve `true` (pasa) o una URL a donde redirigir, igual que `redirect` devuelve `null` o una ruta.

| Guard | Dónde | Regla |
|---|---|---|
| `authGuard` | `/dashboard` y todo lo de adentro | sin sesión → `/auth/login` |
| `guestGuard` | `/auth` | con sesión → `/dashboard` |
| `roleGuard('admin')` | cada página con `data.minRole` | sin el rol → `/dashboard` |

`roleGuard` es una función que **devuelve** un guard (`roleGuard('admin')`), como una función que arma un `redirect` con parámetros.

## Permisos (iguales a Flutter)

| Página | Rol mínimo | En Flutter |
|---|---|---|
| Menú (dashboard, pacientes, venta, historial, egresos) | vendedor | todos |
| Resinas, Armazones, Ventas por vendedor, Funcionalidades, Auditoría | admin | `isAdmin` (admin o megadmin) |
| Ingresos y egresos | supervisor | `adminOrSupervisor` |
| Usuarios | megadmin | `isMegaadmin` |

Por eso Auditoría pasó a "Administración" y Usuarios a "Súper administración": las secciones del diseño siguen a los permisos reales. El menú esconde lo que el usuario no puede abrir (y las secciones vacías), y el guard lo bloquea aunque alguien escriba la URL a mano.

El rol mínimo está en dos lugares (menú y ruta). Un test (`dashboard-nav.spec.ts`) revisa que coincidan.

Las páginas de configuración de Flutter piden además volver a escribir la contraseña de un admin (diálogo P-04). Eso llega con cada página en E2.8.

## Login con Reactive Forms

```ts
protected readonly form = new FormGroup({
  email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
  password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
});
```

| Flutter | Angular |
|---|---|
| `GlobalKey<FormState>` | `FormGroup` |
| `TextEditingController` | `FormControl` |
| `validator: (v) => ...` | `Validators.required`, `Validators.email`, `Validators.minLength(6)` |
| `_formKey.currentState!.validate()` | `form.invalid` |
| `controller.text` | `form.getRawValue().email` |
| `TextFormField(controller: c)` | `<input formControlName="email">` |
| `Form(onSubmit)` / `onFieldSubmitted` | `<form (ngSubmit)="onSubmit()">`: Enter también envía |

- Los mensajes de cada campo aparecen después del primer intento de envío (o al salir del campo), con las mismas reglas de Flutter.
- `LoginStore` se provee en la página (`providers: [LoginStore]`): nace y muere con ella (= `autoDispose`).
- Mientras se valida, el botón dice "Ingresando…" y no se puede pulsar dos veces.
- No hay contador de intentos ni "¿Olvidaste tu contraseña?" (decisión del dueño: paridad con Flutter; el megadmin resetea contraseñas).

## Topbar con el usuario real

La sucursal, el nombre y el rol salen de `SessionStore`. El menú del usuario (C-15 sobre **CDK Menu**) trae "Cerrar sesión"; el CDK resuelve el teclado (flechas, Enter, Esc) y el foco.

## Tests

32 tests. Los de rutas arrancan la app con `FakeAuthRepository` y una sesión del rol que se quiera:

- sin sesión, `/` y `/dashboard/...` mandan al login;
- con sesión, el login manda al dashboard;
- un vendedor no entra a Resinas; un supervisor entra a Ingresos y egresos pero no a Usuarios; un megadmin entra a Usuarios.

## Probado a mano (dev)

Con los usuarios del seed: error con contraseña incorrecta, entrada como vendedor (6 ítems) y como megadmin (13), sesión que sigue tras recargar, rebote del vendedor al pedir Resinas por URL, y "Cerrar sesión" que borra el token (el botón "atrás" ya no vuelve al dashboard).
