import { Component, computed, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Field } from '../../../shared/ui/field/field';
import { OnvInput } from '../../../shared/ui/field/input';
import { RxEyeControls, RxTable } from '../../../shared/ui/rx-table/rx-table';
import { MeasureFormGroup } from './measure-form';

/**
 * Campos de una medida (= secciones "Ojo Derecho/Izquierdo" y "Campos Adicionales" de
 * AddReviewWidget en Flutter). Lo usan tanto el diálogo de Agregar como el de Editar.
 * `idPrefix` evita que se repitan los `id` cuando los dos diálogos están abiertos a la vez
 * (Editar se abre encima de Ver medidas).
 */
@Component({
  selector: 'app-measure-fields',
  imports: [ReactiveFormsModule, Field, OnvInput, RxTable],
  templateUrl: './measure-fields.html',
})
export class MeasureFields {
  readonly form = input.required<MeasureFormGroup>();
  readonly idPrefix = input('measure');

  // P-05 Graduación: ESF/CIL/EJE/AV van juntos en la tabla, no como campos sueltos.
  protected readonly odControls = computed<RxEyeControls>(() => {
    const c = this.form().controls;
    return { esf: c.odEsf, cil: c.odCil, eje: c.odEje, av: c.odAv };
  });
  protected readonly oiControls = computed<RxEyeControls>(() => {
    const c = this.form().controls;
    return { esf: c.oiEsf, cil: c.oiCil, eje: c.oiEje, av: c.oiAv };
  });
}
