// C-02 Input (también estilo de select y date nativos, C-03 y C-04 provisionales)
import { DestroyRef, Directive, afterNextRender, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgControl } from '@angular/forms';

/**
 * Estilo de un control nativo (`<input>`, `<textarea>`, `<select>`) y su estado de error.
 * Va dentro de un `<onv-field>`, que muestra la etiqueta y el mensaje.
 *
 *   <onv-field label="Teléfono" inputId="phone">
 *     <input id="phone" onvInput formControlName="phone" />
 *   </onv-field>
 */
@Directive({
  selector: 'input[onvInput], textarea[onvInput], select[onvInput]',
  host: {
    class:
      'h-(--onv-control-h) w-full rounded-md border border-input bg-input-background px-3 text-body outline-none ' +
      'placeholder:text-muted-foreground hover:border-muted-foreground focus-visible:border-ring ' +
      'focus-visible:outline-2 focus-visible:outline-ring aria-invalid:border-danger ' +
      'disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-foreground ' +
      '[&:is(textarea)]:h-auto [&:is(textarea)]:min-h-20 [&:is(textarea)]:resize-y [&:is(textarea)]:py-2',
    '[attr.aria-invalid]': 'errorKey() ? true : null',
  },
})
export class OnvInput {
  private readonly ngControl = inject(NgControl, { self: true, optional: true });

  /**
   * El estado de un FormControl (tocado, errores) no es un signal, y los componentes son OnPush:
   * este contador sube con cada evento del control para que `errorKey()` vuelva a calcularse
   * donde se lea (la plantilla de `<onv-field>` y el `aria-invalid` de este input).
   */
  private readonly changes = signal(0);

  constructor() {
    const destroyRef = inject(DestroyRef);
    // El control existe una vez hecha la primera pasada de la vista.
    afterNextRender(() => {
      this.ngControl?.control?.events
        .pipe(takeUntilDestroyed(destroyRef))
        .subscribe(() => this.changes.update((n) => n + 1));
    });
  }

  /**
   * Nombre del primer error del control (`required`, `maxlength`...), o null.
   * Solo se muestra después de tocar el campo o de intentar enviar (el error no salta mientras se escribe).
   */
  errorKey(): string | null {
    this.changes();
    const control = this.ngControl?.control;
    if (!control || !control.invalid || !(control.touched || control.dirty)) return null;
    return Object.keys(control.errors ?? {})[0] ?? null;
  }
}
