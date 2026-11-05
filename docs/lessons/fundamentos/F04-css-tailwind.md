# F04: CSS y Tailwind desde Flutter

**Idea central:** HTML describe los elementos; CSS decide cómo se presentan y distribuyen. Tailwind ofrece clases pequeñas que aplican reglas CSS ya preparadas. Solo teoría con ejemplos, sin ejercicios.

## 1. Cajas y medidas

Cada elemento participa en un modelo de caja: contenido, `padding` interior, borde y `margin` exterior. Como un `Padding` dentro de un `Container` de Flutter, el espacio interior separa contenido y borde; el exterior separa la caja de sus vecinas.

```css
.tarjeta {
  padding: 16px;
  border: 1px solid gray;
  margin: 8px;
}
```

`px` es un píxel CSS, no necesariamente un píxel físico de pantalla. `rem` se calcula respecto de la fuente raíz; porcentajes dependen de la propiedad y de la caja de referencia. `box-sizing: border-box` hace que ancho y alto incluyan padding y borde; no conviene asumirlo sin revisar los estilos.

## 2. Selector, cascada y herencia

Una regla tiene selector y declaraciones: `.tarjeta` selecciona elementos con esa clase; `padding: 16px` asigna una propiedad. Varias reglas pueden coincidir. Origen e importancia, especificidad y orden participan en decidir cuál gana. Una regla más específica puede ganar aunque una clase aparezca después en el atributo HTML.

Algunas propiedades como `color` se heredan de un padre; otras como `margin` no. Flutter suele expresar esos estilos en widgets o temas; CSS también puede transmitirlos por el árbol. Usa elementos con significado HTML: el aspecto visual no convierte por sí solo un `div` en botón accesible.

## 3. Flexbox: Row y Column

```html
<div class="flex flex-col gap-4 md:flex-row">
  <div class="flex-1">Paciente</div>
  <button type="button">Guardar</button>
</div>
```

`flex` activa Flexbox; `flex-col` coloca hijos en columna y `md:flex-row` cambia a fila desde el punto `md` del tema activo. `gap-4` separa hijos; `flex-1` permite que el primer hijo ocupe espacio flexible, comparable a `Expanded`, aunque los algoritmos de restricciones no son idénticos.

En fila, `justify-*` actúa sobre el eje principal horizontal y `items-*` sobre el transversal vertical; en columna los ejes cambian. `flex-wrap` permite saltar líneas: no es lo mismo que `overflow` ni que scroll.

## 4. Grid y diseño adaptable

```html
<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
  <section>Ventas</section>
  <section>Pagos</section>
</div>
```

Grid define filas y columnas; aquí hay una columna y desde `md` dos. Se parece a un `GridView` en distribución, pero no implica construcción diferida ni scroll. Los prefijos responsive de Tailwind se basan en media queries del navegador; se parecen a decidir con `MediaQuery` o `LayoutBuilder`, con la diferencia de que la condición vive en CSS.

## 5. Utilidades y tema

`class="rounded border p-4"` reúne utilidades visuales. El HTML conserva su estructura y el archivo de estilos/tema define qué valores corresponden a las utilidades. En este repo Tailwind v4 y los tokens de `src/styles.css` definen colores y escalas compartidos; usa nombres del tema del proyecto en lugar de inventar valores de sucursal o negocio.

Una clase no es una variable TypeScript ni una directiva Angular. Las variantes como `hover:`, `focus-visible:` y `disabled:` aplican reglas según estado; el control sigue necesitando semántica y comportamiento correctos.

## 6. Leer una pantalla real

En una plantilla identifica primero la jerarquía HTML, luego `flex` o `grid`, espaciado, tipografía, colores y variantes responsive. Finalmente lee vinculaciones Angular como `[disabled]`. La lección L01 explica los tokens del proyecto; F03 presenta el árbol HTML.

Referencias: [CSS, MDN](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics) y [Tailwind responsive](https://tailwindcss.com/docs/responsive-design).
