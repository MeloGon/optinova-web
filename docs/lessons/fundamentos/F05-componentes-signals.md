# F05: Componentes y signals desde Flutter y Riverpod

**Idea central:** un componente reúne comportamiento y plantilla; un signal conserva un valor observable y `computed` calcula otro a partir de sus dependencias. Solo teoría y ejemplos, sin ejercicios.

## 1. Componente y plantilla

Un componente Angular se declara con `@Component`, un selector y una plantilla. En este proyecto los componentes son standalone: sus `imports` declaran lo que su plantilla usa. Es comparable a un widget con su `build`, aunque Angular actualiza enlaces en el DOM y no ejecuta el mismo modelo de construcción que Flutter.

```ts
@Component({
  selector: 'app-saludo',
  template: '<p>Hola {{ name() }}</p>',
})
export class Saludo {
  readonly name = signal('Ana');
}
```

`{{ name() }}` lee el signal y muestra su valor como texto. Los ejemplos son didácticos y omiten imports para concentrarse en la idea.

## 2. signal y computed

```ts
readonly quantity = signal(2);
readonly unitPrice = signal(100);
readonly total = computed(() => this.quantity() * this.unitPrice());

increase(): void {
  this.quantity.update(value => value + 1);
}
```

`signal(2)` crea estado; se lee con `quantity()` y se cambia con `set` o `update`. `computed` deriva el total y sigue las señales que lee durante su cálculo. Es comparable a exponer un valor derivado desde un Notifier/provider, no a guardar otra copia manualmente. Si cambia cantidad, la siguiente lectura del total refleja el nuevo resultado.

En los stores del repo es habitual mantener un signal privado y exponer `asReadonly()`; eso limita quién puede llamar `set` o `update`, pero no congela profundamente objetos mutables.

## 3. Plantillas, eventos y condiciones

```html
<p>Total: {{ total() }}</p>
<button type="button" (click)="increase()">Agregar</button>
@if (quantity() > 0) {
  <p>Hay productos</p>
}
@for (item of items(); track item.id) {
  <p>{{ item.name }}</p>
}
```

`(click)` recibe el evento, como `onPressed`; `@if` decide si incluir un bloque; `@for` recorre una colección. `track item.id` da identidad estable para que Angular relacione elementos entre actualizaciones, como una `Key` estable en una lista Flutter. `[disabled]="saving()"` enlaza la propiedad booleana con el estado.

## 4. Datos de entrada y eventos de salida

```ts
readonly title = input.required<string>();
readonly selected = output<string>();

choose(): void {
  this.selected.emit(this.title());
}
```

Un padre puede pasar `[title]="patientName()"` y escuchar `(selected)="openPatient($event)"`. `input` recibe datos; `output` emite eventos. Se parece a campos del constructor de un widget y un callback `ValueChanged`, sin que el hijo tenga que conocer la pantalla que lo usa.

## 5. effect no es otro computed

`computed` expresa un valor derivado. `effect` ejecuta trabajo como reacción a señales y debe reservarse para efectos externos o sincronizaciones justificadas. Leer una señal adicional puede volver a ejecutar el efecto cuando esa señal cambie: importa saber exactamente de qué depende. Los datos derivados suelen ser más claros con `computed`.

Los formularios de Angular tienen su propio estado y eventos; leer una propiedad común de un objeto mutable dentro de `computed` no la convierte automáticamente en signal. En este proyecto se usan puentes reactivos cuando un componente necesita observar esos cambios.

## 6. Relación con el repo

La página muestra datos, el store conserva estado y el repositorio obtiene o guarda información. Signals no reemplazan la autorización ni transforman una petición fallida en exitosa. Ver F07 para el recorrido de login, L09 para Vender y L18 para Dashboard.

Referencias: [signals de Angular](https://angular.dev/guide/signals) y [plantillas](https://angular.dev/guide/templates).
