# F06: Servicios e inyección de dependencias desde Riverpod

**Idea central:** un servicio agrupa una responsabilidad; el inyector de Angular resuelve qué instancia entregar y cuánto dura según dónde se provea. Solo teoría con ejemplos, sin ejercicios.

## 1. ¿Qué es una dependencia?

Si una pantalla necesita cargar pacientes, depende de un repositorio. En lugar de construir directamente su implementación y su cliente de red, pide un contrato. En Riverpod una vista puede leer `ref.read(patientRepositoryProvider)`; en Angular una clase creada por el inyector puede usar `inject(PatientRepository)`.

```ts
@Injectable()
export class PatientsStore {
  private readonly repo = inject(PatientRepository);
}
```

El servicio describe qué necesita, no cómo configurar Supabase. `inject()` debe usarse en un contexto de inyección, como inicialización de campo o constructor gestionado por Angular; no es una función que se pueda invocar desde cualquier callback arbitrario.

## 2. Registrar la implementación

```ts
providers: [
  { provide: PatientRepository, useClass: SupabasePatientRepository },
]
```

La clase abstracta es el token con el que se pide la dependencia; `useClass` indica qué implementación crear. Este registro es un ejemplo conceptual: en el proyecto consulta la configuración real para conocer dónde está registrado. Un fake puede reemplazar la implementación en pruebas sin cambiar los consumidores.

En la aplicación el recorrido es página → store → repositorio abstracto → implementación Supabase → cliente. Las vistas no necesitan llamar a Supabase directamente.

## 3. Alcance y vida

```ts
@Injectable({ providedIn: 'root' })
export class ReceiptService { }
```

`providedIn: 'root'` registra el servicio en el inyector raíz de la aplicación: los consumidores que resuelven ese proveedor comparten su instancia. Se parece a un provider global de Riverpod, pero sus reglas exactas de creación y descarte son las del inyector Angular.

```ts
@Component({
  selector: 'app-patients-page',
  providers: [PatientsStore],
  template: '...',
})
export class PatientsPage { }
```

`providers` en la página crea un alcance asociado a su instancia y a los descendientes que resuelvan ese proveedor. Al destruir la página, Angular destruye ese inyector. Una nueva visita puede empezar con un store nuevo, como la intención de `autoDispose`; no es una equivalencia automática de todas las reglas de Riverpod.

Un proveedor más cercano puede ocultar otro para ese subárbol. Registrar accidentalmente un servicio en dos alcances puede producir dos instancias y estados distintos: hay que mirar dónde se provee y desde dónde se inyecta.

## 4. Una interfaz y sus resultados

El contrato decide operaciones y tipos; la implementación traduce a llamadas de red y convierte errores. En este repo `Result<T, AppError>` obliga al llamador a distinguir éxito y error, idea comparable a `Either`/`fold` en Dart. Un `async` puede devolver `Promise<Result<...>>`: esperar la promesa y comprobar el resultado son pasos distintos.

No debe colocarse una clave privilegiada en un servicio del navegador: inyección organiza código, no vuelve secretos los datos enviados al cliente. Las operaciones privilegiadas se verifican en el servidor.

## 5. Comparación útil

| Riverpod / Flutter | Angular |
|---|---|
| Provider y overrides en pruebas | Token, provider y sustitución de implementación |
| Notifier con estado de pantalla | Store inyectable con signals |
| Provider global | Servicio en inyector raíz, según alcance |
| Provider de vida limitada | Proveedor en página o inyector local |

Ver L02 para `core`, F07 para login y L20 para administración de usuarios. Referencia: [inyección de dependencias de Angular](https://angular.dev/guide/di).
