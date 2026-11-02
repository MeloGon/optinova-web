/**
 * `@types/pdfmake` no cubre las fuentes empaquetadas (`pdfmake/build/fonts/*`): cada una exporta
 * un `TFontContainer` listo para `pdfMake.addFontContainer(...)`.
 */
declare module 'pdfmake/build/fonts/Roboto' {
  import type { TFontContainer } from 'pdfmake/interfaces';
  const fontContainer: TFontContainer;
  export default fontContainer;
}
