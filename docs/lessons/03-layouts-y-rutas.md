# L03: Layouts y rutas (E1.4b)

Ya hay "esqueleto" navegable: login (solo visual), dashboard con menú lateral y barra superior, y todas las rutas de la app Flutter, cada una con una página "en construcción".

```
src/app/
  app.ts                         <router-outlet /> (= MaterialApp.router)
  app.routes.ts                  todas las rutas (= GoRouter)
  core/models/role.ts            roles y hasRole()
  core/models/page-data.ts       title/description de cada ruta
  layouts/
    auth-layout/                 panel de marca + formulario (= AuthLayout)
    dashboard-layout/            sidebar + topbar + contenido (= DashboardLayout)
      dashboard-nav.ts           secciones e ítems del menú
  shared/ui/
    sidebar/                     C-20 Sidebar
    topbar/                      C-21 Topbar
  shared/pages/
    coming-soon.page.ts          "X está en construcción"
    not-found.page.ts            404 (= NoPageFoundView)
  features/
    login/login.page.*           S-01 (visual)
    dashboard/dashboard.page.*   vista previa del diseño (el dashboard real es E2.7)
```

## Rutas = GoRouter

| go_router | Angular |
|---|---|
| `GoRouter(routes: [...])` | `export const routes: Routes = [...]` + `provideRouter(routes)` |
| `GoRoute(path: 'login', builder: ...)` | `{ path: 'login', loadComponent: () => import(...) }` |
| `ShellRoute(builder: (c, s, child) => AuthLayout(child: child))` | `{ path: 'auth', loadComponent: AuthLayout, children: [...] }` y en el layout `<router-outlet />` |
| `child` del ShellRoute | `<router-outlet />`: el hueco donde se pinta la ruta hija |
| `initialLocation` | `{ path: '', redirectTo: 'auth/login' }` |
| `errorBuilder` | `{ path: '**', ... }` (cualquier ruta que no coincida) |
| `context.go('/dashboard')` | `router.navigate(['/dashboard'])` o `<a routerLink="/dashboard">` |
| `state.extra` / parámetros | `data` de la ruta → `input()` de la página (`withComponentInputBinding`) |

### `loadComponent` = carga perezosa

```ts
loadComponent: () => import('./features/login/login.page').then((m) => m.LoginPage)
```

El código de cada página se descarga **solo cuando se visita**. `ng build` lo muestra como "Lazy chunk files". En Flutter web todo va en un solo `main.dart.js`; aquí la primera carga es más liviana.

### Una función para no repetir

Las 12 páginas que aún no existen usan la misma página "en construcción". En vez de repetir 12 bloques, `pending()` arma cada ruta:

```ts
pending('sell', { title: 'Nueva venta', description: '...', delivery: 'E2.6' })
```

Gracias a `withComponentInputBinding()`, el `data` llega solo a los `input()` de la página:

```ts
export class ComingSoonPage {
  readonly title = input('');     // ← data.title
  readonly delivery = input('');  // ← data.delivery
}
```

## Layout del dashboard = Scaffold + Row + Column

```html
<div class="flex h-dvh">                 <!-- Row -->
  <onv-sidebar ... />                    <!-- Sidebar() -->
  <div class="flex flex-1 flex-col">     <!-- Expanded(Column(...)) -->
    <onv-topbar ... />                   <!-- Navbar() -->
    <main class="flex-1 overflow-auto">  <!-- Expanded(child) -->
      <router-outlet />
    </main>
  </div>
</div>
```

`h-dvh` = alto de la pantalla (como el `Scaffold` que ocupa todo).

### Responsive = MediaQuery

Flutter: `if (size.width >= 700) Sidebar()`. Aquí, con `BreakpointObserver` del CDK convertido a signal:

```ts
protected readonly isWide = toSignal(
  this.breakpoints.observe('(min-width: 1280px)').pipe(map((r) => r.matches)),
  { initialValue: true },
);
```

| Ancho | Sidebar | Botón de menú |
|---|---|---|
| ≥ 1280px | expandido (256px) | lo colapsa a íconos (64px); se recuerda en `localStorage` |
| 768 – 1279px | solo íconos | lo abre encima, con velo |
| < 768px | oculto | lo abre encima (= el drawer de Flutter bajo 700px) |

Esc, tocar el velo o elegir un ítem cierran el menú superpuesto.

### `toSignal` y RxJS

El router y el `BreakpointObserver` avisan cambios con **Observables** (RxJS), que son como `Stream` de Dart. `toSignal()` convierte un Stream en signal para leerlo en la plantilla, como un `StreamProvider`. `takeUntilDestroyed()` cancela la suscripción cuando el componente se destruye (= cancelar el `StreamSubscription` en `dispose()`).

### Título de la página

Flutter tenía un `switch` en el Navbar (`_pageTitle(page)`). Aquí cada ruta lleva su `data: { title, description }` y el layout lee la ruta activa al terminar cada navegación (`NavigationEnd`). El título de la pestaña del navegador sale de `title` de la ruta.

## C-20 Sidebar

```html
<a [routerLink]="item.path" routerLinkActive ariaCurrentWhenActive="page">
```

- `routerLinkActive` sabe si la ruta está activa (Flutter lo calculaba a mano con `navigationState.currentPage == ...`).
- `ariaCurrentWhenActive="page"` pone `aria-current="page"`, que usan los lectores de pantalla y el estilo: `aria-[current=page]:bg-primary-subtle` pinta el fondo, la barra de 3px y el texto en negrita. Tres señales, no solo color.
- `exact: true` en Dashboard: si no, `/dashboard` estaría activo en todas las páginas (todas empiezan con `/dashboard`).
- `input()` / `output()` = parámetros y callbacks del widget (`sections`, `collapsed`, `toggle`).

Menú (decidido con el dueño): secciones del diseño en vez de la página hub "Configuración" de Flutter. Las rutas son las mismas.

| Sección | Ítems | Rol mínimo (se aplica en E2.1) |
|---|---|---|
| Menú | Dashboard, Buscar paciente, Agregar paciente, Nueva venta, Historial de ventas, Egresos | todos |
| Inventario | Resinas, Armazones | admin |
| Reportes | Ingresos y egresos, Ventas por vendedor | admin |
| Administración | Usuarios, Funcionalidades | admin |
| Súper administración | Auditoría | megadmin |

`hasRole('admin', 'supervisor')` compara roles por orden: vendedor < supervisor < admin < megadmin.

## C-21 Topbar

Botón de menú, título + descripción (la descripción se oculta en densidad compacta y en móvil), sucursal, claro/oscuro y usuario. Sucursal y usuario son **de ejemplo** hasta E2.1.

`@if (description(); as d)` = `if (description != null) Text(description!)`.

## Íconos: `@lucide/angular`

El diseño pedía `lucide-angular`, pero ese paquete aún no soporta Angular 22. Se usó **`@lucide/angular`**, el paquete oficial nuevo (mismos íconos, signals, sin zone):

```ts
import { LucideSearch } from '@lucide/angular';
protected readonly icon = LucideSearch;
```
```html
<svg [lucideIcon]="icon" [size]="16"></svg>
```

Cada ícono es una importación suelta, así que solo los que se usan entran en el build (como importar solo los `Icons.x` que usas). El trazo de 1.75px se configura una vez en `app.config.ts` con `provideLucideConfig`.

## Login (S-01), solo visual

Panel de marca con el motivo de lente (los círculos usan `fill-primary-*`, así que cambian con el color primario) y las sucursales activas de `ConfigService`. El botón "Ingresar" entra sin validar. El formulario real (Reactive Forms, Supabase Auth, C-01 Button y C-02 Input) es E2.1.

## Tests

`app.spec.ts` prueba las rutas con `RouterTestingHarness` (= `pumpWidget` + navegar con go_router en un widget test): la raíz manda al login, una página pendiente muestra su título y una ruta inexistente muestra el 404.

## Pendiente

- E2.1: sesión real, guards, filtrar secciones por rol, selector de sucursal (C-15), menú de usuario con "Cerrar sesión", splash.
- Tooltip C-16 en el sidebar colapsado (hoy usa el `title` nativo del navegador).
