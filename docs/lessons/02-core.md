# L02: El núcleo (`core/`) (E1.4a)

Piezas sin interfaz que todas las features usarán. Equivalen a `lib/core/` de Flutter.

```
src/app/
  core/
    supabase/supabase.client.ts   cliente Supabase
    result.ts                      Result<T, E>  (= Either)
    errors/app-error.ts            AppError      (= Failure)
    config/config.service.ts       moneda, sucursales, métodos de pago
    theme/                         (L01)
  shared/
    pipes/money.pipe.ts            {{ monto | money }}
```

## Cliente Supabase = `Supabase.instance.client`

```ts
export const SUPABASE = new InjectionToken<SupabaseClient>('SUPABASE', {
  providedIn: 'root',
  factory: () => createClient(environment.supabaseUrl, environment.supabaseKey),
});
```

- `@supabase/supabase-js` es el paquete hermano de `supabase_flutter`: `from('pacientes').select()`, `auth.signInWithPassword()`… casi igual.
- Un **`InjectionToken`** es una "llave" para pedirle algo a Angular que no es una clase propia. Es como un `Provider<SupabaseClient>` de Riverpod: `factory` es la función que lo crea y `providedIn: 'root'` lo hace único (keepAlive).
- Se pide con `inject(SUPABASE)` (= `ref.read(supabaseProvider)`).
- **Solo** lo usan las implementaciones de repos en `core/data/`. Páginas y stores nunca.

## `Result<T, E>` = `Either<L, R>`

```ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
```

Es una **unión discriminada**: un tipo que es una cosa u otra, y el campo `ok` dice cuál. TypeScript lo entiende:

```ts
const r = await repo.searchPatients('ana');
if (r.ok) {
  r.value;   // aquí TS sabe que existe value (= Right)
} else {
  r.error;   // y aquí que existe error (= Left)
}
```

| fpdart | aquí |
|---|---|
| `Right(x)` | `ok(x)` |
| `Left(f)` | `err(f)` |
| `either.fold(onLeft, onRight)` | `if (r.ok) … else …` |
| `either.isRight()` | `r.ok` |

No se instala librería: son 3 líneas.

## `AppError` = `sealed class Failure`

```ts
type AppErrorKind = 'server' | 'network' | 'notFound' | 'unauthorized' | 'unknown';
interface AppError { kind: AppErrorKind; message: string; }
```

Mismos casos que el `Failure` de Flutter más `unauthorized` (RLS que niega, sesión vencida). Un tipo `'a' | 'b'` de strings es el equivalente ligero de un `enum` o de los factories de freezed.

`toAppError(e)` convierte cualquier error en `AppError`. En Flutter cada repo hacía `catch (e) { return Left(Failure.server(e.toString())); }`; aquí se distingue el caso:

| Error | kind |
|---|---|
| `TypeError` de `fetch` (sin internet) | `network` |
| `PGRST116` (`.single()` sin filas) o 404 | `notFound` |
| `42501` (RLS) o 401/403 | `unauthorized` |
| otro código de Supabase | `server` |
| cualquier otra cosa | `unknown` |

Así se verá un repo en E2.x:

```ts
async searchPatients(q: string): Promise<Result<Patient[], AppError>> {
  const { data, error } = await this.supabase.from('pacientes').select().ilike('nombre', `%${q}%`);
  return error ? err(toAppError(error)) : ok(data);
}
```

Nota: supabase-js **no lanza** excepciones en las consultas; devuelve `{ data, error }`. Por eso no hace falta `try/catch` para los errores de la DB.

## `ConfigService`: regla 4b

Moneda, sucursales y métodos de pago salen de aquí, nunca escritos en una plantilla. Hoy devuelve valores fijos; en la Fase 4b los leerá de la tabla `sucursales` y la configuración de cada empresa (cada empresa crea las suyas), y nada más tendrá que cambiar.

Sucursales hoy (revisado en los datos de prod):

| Sucursal | `active` | Por qué |
|---|---|---|
| OFTALVISION | `true` | En uso |
| MEDILENT | `true` | En uso |
| OFTALMIC CENTER | `false` | Cerrada, pero con ~600 pacientes y ventas antiguas |

- `config().branches`: todas, para filtros e historial (no se pierden datos viejos).
- `activeBranches()`: solo las abiertas, para los selects al crear registros. Es un `computed` (= provider derivado que filtra otro).

```ts
readonly config = this.state.asReadonly();   // signal de solo lectura
// en un componente:
protected readonly config = inject(ConfigService).config;
// en la plantilla:
@for (b of config().branches; track b.value) { {{ b.label }} }
```

## `MoneyPipe` = `NumberFormat.currency`

Un **pipe** transforma un valor en la plantilla: `{{ 1250 | money }}` → `S/. 1,250.00`. Es como llamar a una función de formato dentro de un `Text(...)`, pero declarativo.

- Para usarlo, el componente lo importa: `imports: [MoneyPipe]` (en Flutter, el `import` del archivo).
- La lógica está en `formatMoney()`, una función normal que se puede probar sin Angular.
- Negativos con menos tipográfico (`−S/. 124.00`), según el sistema de diseño.

## Tests

`ng test --watch=false` corre 11 tests (Vitest, = `flutter test`):
- `app-error.spec.ts`: cada caso de `toAppError`.
- `money.pipe.spec.ts`: formatos de moneda.
- `supabase.client.spec.ts`: el cliente es único.

`describe` = `group`, `it` = `test`, `expect(x).toBe(y)` = `expect(x, equals(y))`.

## Pendiente (E1.4b)

Layouts (auth y dashboard con C-20 Sidebar y C-21 Topbar) y rutas.
