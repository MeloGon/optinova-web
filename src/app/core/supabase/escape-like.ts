/**
 * `%` y `_` son comodines de `ilike`/`like`: se escriben literales con `\`.
 *
 * Bug encontrado por Antigravity (2026-11-04): la cadena de reemplazo `'\\\\$&'` que tenía antes
 * cada copia de esta función pone DOS barras invertidas (JS solo trata `$` como especial en el
 * segundo argumento de `replace`, la barra invertida no). PostgREST recibía `\\_` en vez de `\_`,
 * así que cualquier búsqueda con un guión bajo (`create_resin`, un modelo con `_`...) no
 * encontraba nada. Con una función de reemplazo en vez de una cadena, `$&` no se interpreta y
 * sale una sola barra.
 */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (match) => `\\${match}`);
}
