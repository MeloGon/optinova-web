# L06: Agregar paciente con Reactive Forms (E2.3a)

**Idea central:** el formulario mantiene lo que se escribe, el store coordina el guardado y el repositorio transforma esos valores en columnas de base de datos. La vista previa observa el formulario y no guarda una copia manual de cada campo.

Solo teoría y ejemplos comparados con Flutter/Riverpod/go_router; sin ejercicios. Código revisado hasta `e3ef363` del 2026-10-26. El alta llegó en `ef10044`; el teléfono secundario y las columnas limpias, en `e3ef363`.

## 1. Qué conserva de la aplicación Flutter

En la referencia Flutter `7d3fa5f`, `AddPatientView` usa `ShadForm`, controllers del provider y secciones de datos personales, contacto y notas. A un lado muestra un resumen y debajo los cinco pacientes recientes. El provider transforma nombre y observaciones a mayúsculas y refresca la lista al guardar.

Angular conserva ese recorrido visual con `AddPatientPage`, `AddPatientStore` y componentes propios. Una diferencia de duración: el provider Flutter original lleva `keepAlive: true`; el store Angular se provee en la página y se destruye con ella. Son responsabilidades comparables, con ciclos de vida diferentes.

La ruta `/dashboard/add-patient` carga la página de forma diferida. El enlace «Ir a vender» de los recientes transmite `patient: patient.id` como query parameter, equivalente a construir un destino con go_router. La pantalla de venta sigue pendiente; ese enlace no demuestra que E2.6 esté implementado.

## 2. FormGroup reúne controles y validadores

La página declara un `FormGroup` con nombre, teléfono, teléfono secundario, género, nacimiento, sucursal y observaciones. Cada `FormControl` reúne el valor y el estado del campo, como las tareas de un controller y su validador en Flutter.

Un extracto simplificado, conservando la estructura del código:

```ts
name: new FormControl('', {
  nonNullable: true,
  validators: [notBlank],
}),
phone: new FormControl('', {
  nonNullable: true,
  validators: [phoneValidator],
}),
```

`nonNullable` mantiene el valor como string y permite volver al valor inicial al reiniciar. No obliga a escribir: esa tarea corresponde al validador. `notBlank` considera inválido un nombre de solo espacios, porque comprueba `control.value.trim()`.

`save()` llama a `markAllAsTouched()` para hacer visibles los errores. Retorna si el grupo es inválido o si el store ya está guardando; después obtiene `getRawValue()`. Esta lectura incluye controles deshabilitados, algo necesario para conservar la sucursal del usuario aunque no pueda cambiarla. [Referencia: formularios reactivos](https://angular.dev/guide/forms/reactive-forms).

La plantilla usa el evento HTML `submit`, evita el envío nativo con `preventDefault()` y llama a `save()`. El botón principal muestra «Guardando…» mientras `saving()` es true. El botón de limpiar no envía el formulario.

## 3. onv-field y onvInput: etiqueta y control son piezas distintas

```html
<onv-field label="Nombre completo" inputId="new-name"
  [required]="true"
  [errors]="{ required: 'Escribe el nombre del paciente.' }">
  <input id="new-name" onvInput formControlName="name" />
</onv-field>
```

`Field` es el contenedor: dibuja etiqueta, asterisco, ayuda y error. `ng-content` deja un lugar para el control real; recuerda a un widget que recibe `child`. `inputId` debe coincidir con el `id` de ese control para asociar la etiqueta.

`OnvInput` es una directiva aplicada al input, textarea o select nativo. Añade estilo y consulta el `NgControl` del mismo elemento para conocer errores. El navegador sigue gestionando edición y teclado del control nativo.

`contentChild(OnvInput)` permite que el contenedor encuentre esa directiva proyectada. El primer error se traduce usando el mapa `errors`; si no hay traducción usa «El valor no es válido.».

El estado de Reactive Forms no es un signal. La directiva se suscribe a los eventos del control después del render y actualiza un signal contador; leerlo permite notificar a las vistas que necesitan reevaluar el error. `takeUntilDestroyed` cancela esa escucha, como liberar una suscripción en `dispose`.

La condición real de `errorKey()` es control inválido y `touched || dirty`. Por tanto, un campo ya editado puede mostrar errores mientras se escribe; no hay que interpretar el comentario del archivo como una prohibición de mostrarlos hasta salir del campo.

## 4. Segmented conecta un componente propio al formulario

Para género se usa `onv-segmented` con tres opciones: Masculino, Femenino y Otro. `clearable` permite volver a pulsar la opción seleccionada para dejar el campo vacío; vacío se envía a la DB como `NULL`.

Se parece al `GenderToggle` Flutter. Angular lo conecta con `formControlName` mediante `ControlValueAccessor`, que funciona como un adaptador entre el control personalizado y Reactive Forms.

| Método o callback | Trabajo |
|---|---|
| `writeValue` | Recibir desde el formulario el valor que debe mostrar |
| `registerOnChange` | Registrar cómo avisar al formulario de una selección |
| `registerOnTouched` | Registrar cómo avisar que se interactuó |
| `setDisabledState` | Recibir el estado deshabilitado |

Al elegir, `choose` actualiza su signal, llama a `onChange` y marca interacción con `onTouched`. No consulta Supabase ni inventa otro campo de género en el store. Los botones tienen semántica de radio dentro de un radiogroup.

## 5. Las reglas que aplica el alta actual

| Campo | Regla de la página |
|---|---|
| Nombre | Obligatorio después de quitar espacios exteriores |
| Teléfono principal | Obligatorio; de 6 a 15 dígitos; admite espacios, +, guion y paréntesis |
| Teléfono secundario | Opcional; si se escribe, aplica el mismo formato |
| Nacimiento | Opcional; no puede ser posterior a hoy |
| Sucursal | Obligatoria; selección limitada por rol en la UI |
| Género y observaciones | Opcionales |

Las comprobaciones de formato cuentan dígitos, no todos los caracteres escritos. El teléfono sigue siendo texto para conservar prefijos y presentación.

La entrada de fecha tiene un mínimo HTML de 1900-01-01 y un máximo de hoy. El validador personalizado de TypeScript comprueba fecha futura; no incluye una regla adicional de año mínimo ni un parser completo de fechas arbitrarias. La DB usa `date`.

Solo admin y megadmin pueden cambiar sucursal en el alta Angular. La página pregunta `session.can('admin')`; el resto conserva su sucursal con el control deshabilitado. Las opciones vienen de `ConfigService.activeBranches()`, incluyendo la del usuario si fuera una sucursal histórica cerrada. Deshabilitar un selector es una regla de interacción, no sustituye la autorización del servidor.

El código actual valida el formato del teléfono secundario, pero no impide guardar el mismo número en ambos campos. La eliminación de teléfonos repetidos descrita en L07 pertenece a la migración de datos históricos.

## 6. El aviso de nombre repetido no es una restricción única

Antes de crear, la página recorta espacios, reduce secuencias de espacios a uno y convierte el nombre a mayúsculas. `findByName` busca igualdad de nombre sin distinguir mayúsculas y devuelve como máximo cinco coincidencias.

Si hay coincidencias, `ConfirmService` informa de un paciente con ese nombre y su fecha de registro. El usuario puede cancelar o elegir «Crear de todos modos». El nombre no es una clave única: pueden existir homónimos.

El mensaje actual advierte que medidas y ventas heredadas se enlazan por nombre. El dueño decidió reemplazar esos enlaces por IDs durante sus entregables; esa transición aún no está implementada aquí. El aviso no debe confundirse con la futura FK de revisiones.

`AddPatientStore.findDuplicates` transforma un error de esa consulta en una lista vacía. Así, el aviso es una ayuda que puede no aparecer si la consulta falla; no garantiza unicidad ni bloquea duplicados simultáneos. `saving` se activa al entrar en `store.create`, después de la consulta y posible confirmación.

## 7. La vista previa deriva del formulario

`form.valueChanges` emite un Observable, comparable a un Stream de Dart. La página lo convierte a signal con `toSignal`, usando `getRawValue()` para armar el borrador y un valor inicial para que exista desde el primer render.

`computed initials` calcula las iniciales de la primera y última palabra. La plantilla muestra nombre en mayúsculas, sucursal, teléfono, género y nacimiento; si faltan datos usa textos de reemplazo. Esto recuerda al `AnimatedBuilder` que observa controllers en el resumen Flutter, pero aquí la lectura procede de `draft()`.

El borrador no es un paciente persistido. No tiene un ID fabricado para la vista previa; el ID se obtiene al guardar. En pantallas amplias CSS Grid coloca el resumen al lado; en estrechas aparece en el flujo vertical.

## 8. Guardar y volver a un formulario limpio

`NewPatient` se define con `Omit<Patient, 'id' | 'registeredOn'>`: un tipo de entrada que no permite exigir esos datos al usuario. El repositorio hace el insert sin ID ni fecha de registro; la base los asigna y devuelve el paciente creado.

Antes del insert se recortan teléfonos, se normaliza el nombre y se convierten observaciones a mayúsculas. Nacimiento vacío se transforma en `null`. `toColumns` traduce nombres ingleses de la app a columnas de negocio en español.

Si la creación tiene éxito, el store recarga los cinco recientes, la página muestra un toast y limpia el formulario conservando la sucursal del usuario. Si falla, muestra el mensaje y conserva lo escrito. La lista de recientes es una ayuda: si su carga falla, el store conserva la lista anterior.

La responsabilidad del Notifier se reconoce fácilmente: coordinar una operación asíncrona y actualizar estado visible. La responsabilidad del formulario también: manejar el borrador y validar antes de entregar datos al repositorio.

Fuentes: commits `ef10044` y `e3ef363`; `src/app/features/add-patient/`, `shared/ui/field/`, `shared/ui/segmented/` y repositorio de pacientes. Referencia Flutter: [alta original](https://github.com/MeloGon/oftal_web/tree/7d3fa5f/lib/features/add_patient).
