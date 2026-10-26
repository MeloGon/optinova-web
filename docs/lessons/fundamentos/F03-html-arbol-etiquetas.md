# F03: HTML básico: de un árbol de widgets a un árbol de etiquetas

**Idea central:** HTML describe la estructura y el significado de una pantalla. Anidar elementos recuerda a anidar widgets; CSS define su presentación y Angular conecta esa estructura con el estado.

Prerrequisitos: F00 y F01. Tiempo estimado: 20 minutos. Solo teoría y ejemplos; sin ejercicios.

## 1. Leer una etiqueta

```html
<p>Nombre del paciente</p>
```

`<p>` abre un párrafo, el texto es su contenido y `</p>` lo cierra. El conjunto forma un elemento HTML. Las etiquetas indican dónde comienza y termina; el elemento incluye también su contenido.

Compáralo con Dart:

```dart
const Text('Nombre del paciente')
```

Ambos pueden mostrar texto, pero `<p>` expresa que es un párrafo. HTML también tiene encabezados, enlaces, listas y controles con significado propio.

## 2. Padres, hijos y hermanos

```dart
Column(
  children: [
    const Text('Paciente'),
    const Text('Ana'),
    FilledButton(onPressed: save, child: const Text('Guardar')),
  ],
)
```

Una estructura HTML comparable para leer el contenido sería:

```html
<section>
  <h2>Paciente</h2>
  <p>Ana</p>
  <button type="button">Guardar</button>
</section>
```

```text
section
  h2: texto Paciente
  p: texto Ana
  button: texto Guardar
```

`section` es el padre. `h2`, `p` y `button` son hijos y también hermanos entre sí. El texto «Guardar» está dentro del botón.

Esta comparación explica la jerarquía; no promete el mismo diseño que `Column`. El tamaño, la separación y la distribución se resuelven con CSS. Los elementos tienen estilos iniciales del navegador que los estilos del proyecto pueden modificar.

Las etiquetas se cierran respetando el anidamiento. No todo hijo es válido dentro de cualquier padre: por ejemplo, un párrafo no debe contener una sección. Ante HTML inválido, el navegador puede reorganizar la estructura. [Referencia: sintaxis básica de HTML](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content/Basic_HTML_syntax).

## 3. Atributos: información en la etiqueta de apertura

```html
<input id="patient-name" type="text" placeholder="Nombre completo">
```

Los atributos son los pares escritos dentro de la apertura. Se parecen a parámetros de un widget, aunque su funcionamiento pertenece a HTML:

| Atributo | Qué expresa |
|---|---|
| `id="patient-name"` | Identificador que debe ser único dentro del documento |
| `type="text"` | Tipo de control |
| `placeholder="Nombre completo"` | Pista que aparece cuando el campo está vacío |
| `class="..."` | Nombres de clases que pueden usar los estilos |

`input` es un elemento vacío: no tiene contenido hijo ni etiqueta `</input>`. `img` y `br` también son vacíos. En HTML, la barra final de `<input />` no crea una regla general de autocierre para cualquier etiqueta.

Un atributo booleano funciona por presencia. En HTML estático, tanto `<button disabled>` como `<button disabled="false">` dejan el botón deshabilitado. Para controlar un booleano desde Angular se usa una vinculación de propiedad, que veremos más adelante.

## 4. Elegir elementos por lo que significan

| Elemento | Significado | Comparación útil con Flutter |
|---|---|---|
| `h1` a `h6` | Encabezados con distintos niveles | Texto que además identifica una sección |
| `p` | Párrafo | Text para un bloque de prosa |
| `span` | Contenedor genérico dentro del texto | Un fragmento dentro de un texto |
| `div` | Contenedor genérico | Agrupación sin significado adicional |
| `main` | Contenido principal | Zona central de la página |
| `nav` | Grupo de enlaces de navegación | Zona de navegación |
| `section` | Sección temática, normalmente con título | Agrupación de contenido relacionado |
| `ul`, `ol`, `li` | Listas y sus elementos | Lista de contenido, sin implicar scroll |
| `a` con `href` | Enlace a otro destino | Acción de navegación |
| `button` | Control para ejecutar una acción | Botón con callback |

Estas equivalencias ayudan a interpretar el propósito. Un `div` no añade por sí mismo el comportamiento visual de un `Container`, ni una lista HTML equivale al constructor diferido de `ListView.builder`.

Un botón nativo ya participa en la navegación por teclado y tiene semántica de botón para tecnologías de asistencia. Convertir un `div` en un control requiere implementar comportamientos que HTML ya ofrece. Elegir un elemento apropiado simplifica tanto el código como el uso de la pantalla.

## 5. Un campo necesita una etiqueta visible

```html
<form>
  <label for="patient-name">Nombre del paciente</label>
  <input id="patient-name" name="patientName" type="text">
  <button type="submit">Guardar</button>
  <button type="button">Cancelar</button>
</form>
```

`for` relaciona el `label` con el `id` del campo. Esa asociación da al control un nombre accesible y permite enfocarlo al pulsar la etiqueta. El `placeholder` es una pista temporal y no sustituye al `label`.

`name` identifica al control al construir los datos de un envío HTML nativo; es diferente de `id`. El botón `submit` solicita el envío del formulario. El botón `button` representa una acción que no lo envía. Dentro de un formulario conviene escribir el tipo explícitamente para que una acción secundaria no provoque un envío accidental.

Esto recuerda a `Form`, `TextFormField` y los botones en Flutter, pero el ejemplo solo muestra estructura HTML. No guarda datos en Supabase ni conecta un `FormGroup`. En las páginas del repo, Reactive Forms y el store agregan esa lógica. [Referencia: formularios del estándar HTML](https://html.spec.whatwg.org/multipage/forms.html).

## 6. El DOM: lo que el navegador construye

El archivo HTML es texto. Al leerlo, el navegador construye un árbol de objetos llamado DOM, abreviatura de *Document Object Model*. Cada elemento y cada nodo de texto ocupa un lugar en ese árbol.

La analogía con un árbol de widgets ayuda a entender padres e hijos, pero son estructuras distintas. El DOM pertenece al navegador; Angular lo actualiza cuando cambian los valores vinculados de la aplicación. No hace falta manipularlo manualmente para mostrar un nombre o deshabilitar un botón.

En este proyecto, `src/index.html` contiene el documento inicial y `<app-root>`. Angular arranca en ese elemento e incorpora el contenido de los componentes.

## 7. HTML del documento y plantilla de Angular

Una plantilla de Angular usa HTML y agrega sintaxis que interpreta Angular:

```html
<h2>{{ patientName }}</h2>
<button type="button" [disabled]="saving" (click)="save()">
  Guardar
</button>
```

Para leer este fragmento, supón que el componente tiene `patientName: string`, `saving: boolean` y un método `save()`.

| Sintaxis | Cómo leerla | Comparación Flutter |
|---|---|---|
| `{{ patientName }}` | Muestra el valor como texto | `Text(patientName)` |
| `[disabled]="saving"` | Asigna el booleano a la propiedad disabled | Deshabilitar según el estado |
| `(click)="save()"` | Ejecuta save al recibir el evento | `onPressed: save` |

Los corchetes evalúan una expresión del componente; no escriben el texto literal «saving». Los paréntesis conectan un evento con una acción. El navegador no interpreta estas instrucciones por sí solo: Angular las procesa como parte de la plantilla. [Referencia: vinculación de propiedades y texto](https://angular.dev/guide/templates/binding).

Si el valor fuera un signal, su lectura sería una llamada, por ejemplo `{{ patientName() }}`. Esa diferencia se estudia en F05. También allí se verán `@if` y `@for`; aquí basta con reconocer qué parte es estructura HTML y cuál conecta datos.

## 8. Componentes propios y clases CSS

Una etiqueta con nombre del proyecto puede representar un componente Angular. Su selector lo define la clase del componente; no todas las etiquetas son elementos nativos del navegador.

```html
<div class="flex flex-col gap-4">
  <h2>Paciente</h2>
  <p>Ana</p>
</div>
```

`div`, `h2` y `p` describen la estructura. Los nombres dentro de `class` se relacionan con las reglas CSS de Tailwind: en este caso organizan los hijos verticalmente y dejan espacio entre ellos. No son nuevas etiquetas ni instrucciones de TypeScript.

La separación resulta útil al leer una pantalla: primero identifica el árbol y el significado de sus elementos; después, las clases que les dan presentación; por último, las expresiones y eventos que los conectan con el componente. F04 desarrolla la parte visual con CSS y Tailwind desde `Row`, `Column`, `Padding` y `Expanded`.
