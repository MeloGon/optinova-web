# F01: TypeScript desde Dart (1): variables, tipos, null safety, funciones

**Idea central:** TypeScript es casi Dart con otra ortografía. La diferencia más visible: en Dart el tipo va **antes** del nombre; en TypeScript va **después**, con dos puntos.

```dart
String nombre = 'Ana';      // Dart
```
```ts
let nombre: string = 'Ana'; // TypeScript
```

Tiempo estimado: 20 minutos de lectura.

---

## 1. Variables

| Dart | TypeScript | Significado |
|---|---|---|
| `var x = 5;` | `let x = 5;` | Se puede reasignar |
| `final x = 5;` | `const x = 5;` | No se puede reasignar |
| `const x = 5;` | `const x = 5;` | (TS no distingue final/const) |
| `int x = 5;` | `let x: number = 5;` | Con tipo explícito |

```ts
let contador = 0;        // TS deduce el tipo: number
contador = 1;            // ok
const sucursal = 'MEDILENT';
sucursal = 'OTRA';       // ❌ error: es const
```

En el código del proyecto casi todo es `const` o `readonly` (lo mismo, pero dentro de una clase), igual que en Flutter preferimos `final`.

## 2. Tipos básicos

| Dart | TypeScript | Nota |
|---|---|---|
| `int`, `double` | `number` | TS tiene un solo tipo para números |
| `String` | `string` | en minúscula |
| `bool` | `boolean` | |
| `List<String>` | `string[]` (o `Array<string>`) | |
| `Map<String, int>` | `Record<string, number>` | |
| `dynamic` | `any` | evitarlo, igual que `dynamic` |
| `void` | `void` | |

Textos con variables:

```dart
'Hola $nombre, tienes ${edad + 1} años'
```
```ts
`Hola ${nombre}, tienes ${edad + 1} años`   // comillas invertidas ` `
```

## 3. Null safety

Es igual de estricto que Dart, con otra forma de escribir "puede ser nulo":

| Dart | TypeScript |
|---|---|
| `String? nombre` | `nombre: string \| null` |
| `nombre ?? 'Sin nombre'` | `nombre ?? 'Sin nombre'` (igual) |
| `perfil?.nombre` | `perfil?.nombre` (igual) |
| `nombre!` | `nombre!` (igual, y igual de peligroso) |

```ts
let perfil: Perfil | null = null;   // = Perfil? perfil = null;
```

La barra `|` se lee "**o**": `string | null` = "un string **o** null". Esto aparece mucho en el proyecto:

```ts
private readonly state = signal<Profile | null>(null);
//                              ^^^^^^^^^^^^^^ un Profile o null (sin sesión)
```

## 4. Funciones

```dart
// Dart
String saludar(String nombre, {int? edad}) {
  return 'Hola $nombre';
}
final doble = (int x) => x * 2;
```
```ts
// TypeScript
function saludar(nombre: string, edad?: number): string {
  return `Hola ${nombre}`;
}
const doble = (x: number) => x * 2;
```

| Dart | TypeScript |
|---|---|
| tipo de retorno antes: `String saludar(...)` | después: `saludar(...): string` |
| parámetro opcional `{int? edad}` / `[int? edad]` | `edad?: number` |
| valor por defecto `{int edad = 18}` | `edad = 18` |
| función flecha `(x) => x * 2` | `(x) => x * 2` (igual) |

### `async` / `await`

Casi idéntico. `Future<T>` se llama `Promise<T>`:

```dart
Future<String> cargar() async { ... }
```
```ts
async function cargar(): Promise<string> { ... }
```

## 5. Listas: `map`, `filter`, `find`

Las mismas ideas que en Dart, con nombres parecidos:

| Dart | TypeScript |
|---|---|
| `lista.map((x) => x * 2).toList()` | `lista.map((x) => x * 2)` (ya es lista) |
| `lista.where((x) => x > 2).toList()` | `lista.filter((x) => x > 2)` |
| `lista.firstWhere((x) => x > 2)` | `lista.find((x) => x > 2)` (devuelve `undefined` si no hay) |
| `lista.length` | `lista.length` |
| `lista.isEmpty` | `lista.length === 0` |

Esto ya está en el código del menú lateral:

```ts
section.items.filter((item) => this.session.can(item.minRole))
//            ^^^^^^ = .where(...)
```

## 6. Igualdad: `===`

En TypeScript se compara con **tres** iguales: `===` y `!==`. (Existe `==`, pero hace conversiones raras: no se usa.)

```ts
if (rol === 'admin') { ... }
```

---

## Errores típicos al venir de Dart

Salieron del primer ejercicio del dueño. Funcionan, pero no son la forma correcta:

| Así no | Así sí | Por qué |
|---|---|---|
| `nombre: String` | `nombre: string` | `String` con mayúscula es un envoltorio antiguo de JavaScript. Los tipos van en minúscula: `string`, `number`, `boolean` |
| `nombre?: string \| null` | `nombre: string \| null` | En TS, `?` en un parámetro significa **opcional** (se puede no pasar y vale `undefined`). `String?` de Dart es solo `string \| null` |
| `if (nombre === null) return 'X'; return nombre;` | `return nombre ?? 'X';` | `??` es igual que en Dart y además cubre `null` y `undefined` |
| `rol == 'admin'` | `rol === 'admin'` | `==` convierte antes de comparar (`0 == ''` es `true`). Siempre `===` y `!==` |
| `if (cond) { return true; } return false;` | `return cond;` | La condición ya es un `boolean` |
| función sin tipo de retorno | `function f(): string { ... }` | Como en Dart: declarar qué devuelve ayuda a leer y evita errores |

Ejemplo bien escrito:

```ts
function nombreOVacio(nombre: string | null): string {
  return nombre ?? 'Sin nombre';
}

function esAdmin(rol: string): boolean {
  return rol === 'admin' || rol === 'megadmin';
}
```

## Cómo probar código TypeScript (opcional)

Igual que `dart run archivo.dart`, Node corre un archivo `.ts` directo:

```bash
node archivo.ts
```

Node ejecuta el archivo, pero **no revisa los tipos** (los ignora). Para que TypeScript revise los tipos, como el analizador de Dart:

```bash
npx tsc --noEmit --strict --ignoreConfig archivo.ts
```

Si no imprime nada, no hay errores de tipos. En `practica/F01/ejercicio.ts` está el primer ejercicio del dueño como ejemplo.
