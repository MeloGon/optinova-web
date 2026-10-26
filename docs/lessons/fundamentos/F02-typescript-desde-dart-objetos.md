# F02: TypeScript desde Dart (2): objetos y organización del código

**Idea central:** un objeto de JavaScript puede representar datos sin crear una clase. TypeScript permite describir su forma con una interfaz, combinar estados con uniones y reutilizar tipos con genéricos.

Prerrequisito: F01. Tiempo estimado: 25 minutos. Solo teoría y ejemplos comparados; sin ejercicios.

## 1. Un objeto agrupa propiedades

En Dart sueles definir una clase o un modelo freezed para representar un paciente. En TypeScript puedes empezar con un objeto literal:

```ts
const patient = {
  id: 'demo-1',
  name: 'Ana',
  phone: null,
};

console.log(patient.name);
```

Las llaves agrupan pares `nombre: valor`. No se escribe `new` porque aquí no estamos llamando al constructor de una clase propia. Aunque recuerde a un `Map` de Dart, TypeScript puede conocer las propiedades concretas del objeto y sus tipos.

`const` impide reasignar la variable, pero no vuelve inmutable su contenido:

```ts
const patient = { name: 'Ana' };
patient.name = 'Elena'; // permitido
```

Se parece a una variable `final` de Dart que apunta a un objeto mutable. No equivale a construir un objeto constante de Dart.

## 2. interface: describir la forma de los datos

```ts
interface Patient {
  readonly id: string;
  readonly name: string;
  readonly phone: string | null;
  readonly email?: string;
}

const patient: Patient = {
  id: 'demo-1',
  name: 'Ana',
  phone: null,
};
```

`Patient` exige `id`, `name` y `phone`; `email` puede omitirse. Al leer `patient.email`, el resultado puede ser `undefined`. En cambio, `phone` debe estar presente y permite explícitamente `null`.

`readonly` impide asignar a esas propiedades a través de esa referencia durante la comprobación de tipos. No congela el objeto en ejecución ni vuelve inmutables todos sus objetos internos.

Una interfaz no genera un constructor: `new Patient()` no existe. En Dart, una clase con campos y constructor produce instancias; aquí la interfaz solo describe qué propiedades debe tener un valor. Las interfaces se eliminan al preparar JavaScript. [Referencia: tipos de objetos e interfaces](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html).

TypeScript compara principalmente la estructura: un valor compatible puede usarse como `Patient` sin declarar que hereda de él. Esto difiere de la relación nominal entre clases e interfaces de Dart.

## 3. Copiar datos: spread y copyWith

En un modelo freezed de Dart:

```dart
final updated = patient.copyWith(name: 'Elena');
```

En TypeScript, para un objeto plano:

```ts
const updated: Patient = {
  ...patient,
  name: 'Elena',
};
```

`...patient` copia sus propiedades propias enumerables y la última asignación de `name` reemplaza la anterior. Es una copia superficial: si hubiera un objeto anidado, ambos valores seguirían compartiéndolo salvo que también se copiara.

No aparecen automáticamente `copyWith`, igualdad por valor, serializadores ni validadores. El spread tampoco conserva los métodos del prototipo de una instancia de clase; esta equivalencia se usa para datos planos.

## 4. class: datos y comportamiento con instancias

Las clases resultan útiles cuando necesitamos constructor y métodos:

```dart
class Greeting {
  final String prefix;
  Greeting(this.prefix);

  String forName(String name) => '$prefix $name';
}
```

En TypeScript se mantienen el constructor y el método, con los tipos después de los nombres. Para obtener una instancia se usa `new`. El siguiente ejemplo devuelve el saludo; no modifica el nombre recibido ni necesita un componente Angular para expresar ese comportamiento.

```ts
class Greeting {
  constructor(readonly prefix: string) {}
  forName(name: string): string {
    return `${this.prefix} ${name}`;
  }
}
const greeting = new Greeting('Hola');
greeting.forName('Ana');
```

El parámetro `readonly prefix` del constructor declara e inicializa una propiedad. En TypeScript el acceso a propiedades de la instancia se escribe con `this`, como `this.prefix`.

`public` permite acceso desde fuera; `private` lo restringe a la clase durante la comprobación de tipos; `protected` también permite acceso a las subclases. En Dart, un nombre con `_` es privado de la biblioteca, no exactamente de la clase. JavaScript también ofrece campos `#private` con privacidad en ejecución; son un mecanismo distinto del modificador `private` de TypeScript. [Referencia: clases](https://www.typescriptlang.org/docs/handbook/2/classes.html).

Una `abstract class` puede definir métodos que implementará una subclase. En este repo se usa para los contratos de repositorio. A diferencia de una interfaz de TypeScript, una clase abstracta conserva una representación en JavaScript; Angular puede usarla como identificador al inyectar una implementación. La inyección se estudiará en F06.

## 5. type y uniones: un valor entre varias posibilidades

`type` da nombre a un tipo. Puede describir objetos, pero también uniones:

```ts
type Role = 'supervisor' | 'admin' | 'megadmin';
const role: Role = 'admin';
```

La barra significa «o». Un `Role` admite esas cadenas concretas. Sirve para restringir valores, como un enum de Dart, aunque aquí los valores siguen siendo strings y no se crea un objeto enum en ejecución.

Una unión también puede describir estados con datos distintos, parecido a una jerarquía sellada o una unión de freezed:

```ts
type LoadState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'failed'; message: string };
function describe(state: LoadState<Patient>): string {
  if (state.status === 'ready') {
    return state.data.name;
  }
  if (state.status === 'failed') {
    return state.message;
  }
  return 'Cargando';
}
```

`status` identifica la variante. Al comprobarlo, TypeScript sabe qué propiedades están disponibles en esa rama: eso se llama estrechamiento de tipos, o *narrowing*. `data` solo existe en `ready`. Es una forma de evitar combinaciones ambiguas de varios booleanos. Este ejemplo enseña el lenguaje; no introduce un nuevo store en el proyecto. [Referencia: uniones discriminadas](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions).

## 6. Genéricos: conservar la relación entre tipos

En Dart ya conoces `List<Patient>` y `Future<Patient>`. La letra `T` representa un tipo que se elige al usar una función o estructura:

```dart
T identity<T>(T value) => value;
```

```ts
function identity<T>(value: T): T {
  return value;
}

const name = identity<string>('Ana');
const count = identity(3); // infiere number
```

El genérico conserva la relación entre entrada y salida. Con `any` perderíamos esa comprobación.

En `LoadState<Patient>`, la `T` de la variante `ready` pasa a ser `Patient`. De manera parecida, `Result<T, AppError>` en el proyecto expresa el tipo del dato y el del error. Los genéricos de TypeScript no permiten descubrir `T` ni construirlo automáticamente en ejecución. [Referencia: genéricos](https://www.typescriptlang.org/docs/handbook/2/generics.html).

## 7. import y export: conectar archivos

En Dart importas una biblioteca y sus nombres públicos están disponibles. En TypeScript se exportan explícitamente los nombres que otro archivo puede importar:

```ts
// patient.ts
export interface Patient {
  readonly id: string;
  readonly name: string;
}

export function displayName(patient: Patient): string {
  return patient.name;
}
```

```ts
// otro archivo TypeScript
import type { Patient } from './patient';
import { displayName } from './patient';
```

`./` apunta al mismo directorio y `../` al directorio superior. En este proyecto las importaciones de archivos TypeScript suelen omitir la extensión. Un nombre como `@angular/core` señala un paquete instalado.

`import type` declara que el nombre solo se usa para tipos y se elimina de JavaScript. `displayName`, en cambio, es una función que sí existe al ejecutar la aplicación. Esta distinción también explica por qué una interfaz no sirve como identificador de inyección en Angular. [Referencia: módulos](https://www.typescriptlang.org/docs/handbook/2/modules.html).

## 8. async y await: de Future a Promise

```dart
Future<String> loadName() async {
  return 'Ana';
}
```

```ts
async function loadName(): Promise<string> {
  return 'Ana';
}

async function greeting(): Promise<string> {
  const name = await loadName();
  return `Hola ${name}`;
}
```

Una función `async` devuelve una promesa. `await` espera su resultado dentro de esa función sin bloquear toda la interfaz. Si la promesa se rechaza, `await` lanza ese error y puede atenderse con `try/catch`. Eso se parece al manejo de un `Future` que falla.

Una diferencia útil: llamar a una función `async` de JavaScript comienza a ejecutar su cuerpo inmediatamente hasta que llega a una suspensión; no convierte todo el trabajo en otro hilo. Un cálculo síncrono pesado puede bloquear la página aunque esté dentro de una función `async`. [Referencia: funciones async](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function).

## 9. Los tipos no validan la respuesta del servidor

Escribir `value as Patient` pide al compilador que trate ese valor como un paciente. No comprueba que tenga `id` y `name`, ni convierte fechas ni llama a un `fromJson`.

La comparación con freezed sirve para entender la forma de los datos, pero el JSON externo necesita comprobaciones y transformación cuando corresponda. Una interfaz no sustituye esa frontera. Esta distinción ayuda a leer el flujo del proyecto: página, store, repositorio y acceso a Supabase.

Con estos conceptos puedes reconocer qué partes de un archivo describen tipos y cuáles producen comportamiento. F03 pasa a la otra mitad de un componente: la estructura HTML de su pantalla.
