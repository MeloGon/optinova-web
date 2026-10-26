# F00: Mapa del ecosistema web desde Flutter

**Idea central:** en Flutter una sola herramienta reúne muchas tareas. En Angular verás varias piezas: Node ejecuta herramientas, npm administra paquetes, Angular CLI construye la aplicación y el navegador la ejecuta para el usuario.

Tiempo estimado: 15 minutos. Solo teoría con ejemplos; los comandos se muestran para entender su función.

## 1. Las piezas del mapa

| En Flutter / Dart | En este proyecto web | Para qué sirve |
|---|---|---|
| Dart | TypeScript y JavaScript | Escribir la lógica |
| Flutter | Angular | Organizar componentes, estado, formularios y rutas |
| Herramientas que usan el Dart SDK | Herramientas que usan Node.js | Ejecutar programas de desarrollo en tu computadora |
| pub | npm | Administrar dependencias y ejecutar scripts |
| flutter CLI | Angular CLI, comando ng | Servir, construir y generar archivos |
| Widgets y propiedades visuales | HTML y CSS | Definir estructura y presentación |
| Chrome como destino de Flutter web | Navegador | Mostrar la aplicación y ejecutar su JavaScript |

Son equivalencias de función, no reemplazos exactos. Por ejemplo, Node no incluye el compilador de TypeScript: este llega como paquete del proyecto.

## 2. JavaScript y TypeScript

JavaScript es el lenguaje que ejecuta el navegador para dar comportamiento a la página. TypeScript agrega un sistema de tipos para trabajar con ese código: permite expresar que un nombre es un `string` o que una función devuelve un paciente.

```ts
const patientName: string = 'Ana';
```

La anotación `: string` sirve durante el desarrollo. En la aplicación compilada el navegador recibe JavaScript, sin esa anotación. Angular también procesa las plantillas y reúne el código necesario.

En Flutter escribes Dart y las herramientas producen la aplicación para el destino elegido. Aquí escribes TypeScript, HTML y CSS; las herramientas preparan los archivos que entiende el navegador.

El editor puede señalar un tipo incorrecto antes de abrir la página, como el analizador de Dart. Esa comprobación y la ejecución son momentos distintos: un error de tipos se detecta al preparar el código; una respuesta inesperada del servidor puede causar un problema mientras el usuario utiliza la aplicación.

## 3. Node.js: ejecutar herramientas fuera del navegador

Node.js permite ejecutar JavaScript en tu computadora, fuera de una pestaña. En este repositorio lo usan Angular CLI y el generador de PDF. El navegador del paciente o del vendedor no necesita tener Node instalado para abrir la aplicación publicada.

El script `scripts/docs/md-to-pdf.mjs` es un ejemplo: Node lee Markdown y escribe un archivo PDF en el disco. Ese trabajo pertenece a la computadora de desarrollo. [Referencia: introducción oficial a Node.js](https://nodejs.org/en/learn/getting-started/introduction-to-nodejs).

Node y el navegador tienen capacidades diferentes. Un script de Node puede trabajar con archivos mediante sus APIs; el código de la página usa APIs del navegador, como el documento visible. Compartir lenguaje no los convierte en el mismo entorno.

## 4. npm: paquetes y comandos del proyecto

En Flutter declaras dependencias en `pubspec.yaml` y las obtienes con `flutter pub get`. Aquí se declaran en `package.json` y se instalan con `npm install`.

| Archivo o carpeta | Qué contiene |
|---|---|
| `package.json` | Dependencias declaradas y scripts disponibles |
| `package-lock.json` | Versiones resueltas e información para reproducir la instalación |
| `node_modules/` | Paquetes instalados en esta computadora; no se suben al repo |

`node_modules/` se parece al conjunto de paquetes descargados por pub; no es una equivalencia exacta de `.dart_tool/`, que contiene configuración y archivos generados de Dart.

En `package.json` hay dos grupos: `dependencies` y `devDependencies`. El segundo reúne herramientas de desarrollo, como TypeScript y el generador de PDF. Esa clasificación no significa que el navegador reciba todo el primer grupo: el proceso de construcción determina qué código necesita la aplicación.

Los scripts son nombres cortos para comandos. Este fragmento corresponde al repositorio:

```json
{
  "scripts": {
    "start": "ng serve",
    "build": "ng build",
    "test": "ng test",
    "pdf": "node scripts/docs/md-to-pdf.mjs"
  }
}
```

`npm start` ejecuta `ng serve`; `npm run build` ejecuta `ng build`. `start` y `test` tienen formas abreviadas; para `pdf` se escribe `npm run pdf`. Los scripts encuentran las herramientas instaladas localmente en el proyecto. [Referencia: package.json de npm](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/).

## 5. Angular CLI: el equivalente práctico de flutter CLI

CLI significa interfaz de línea de comandos: una herramienta que recibe instrucciones escritas en la terminal.

| Flutter | Angular en este repo | Resultado |
|---|---|---|
| `flutter run -d chrome` | `npm start` | Inicia el servidor de desarrollo |
| `flutter build web` | `npm run build` | Produce los archivos de publicación |
| `flutter test` | `npm test` | Ejecuta las pruebas configuradas |
| Crear un widget manualmente | `ng generate component ...` | Genera archivos de un componente |

Con `ng serve`, el servidor de desarrollo entrega la aplicación en `http://localhost:4200`. `localhost` significa esta computadora; `4200` identifica el puerto. Al editar archivos, las herramientas actualizan la aplicación durante el desarrollo. Esa experiencia recuerda a `flutter run`, aunque los mecanismos de actualización y conservación de estado son distintos.

`ng build` escribe el resultado en `dist/`, según la configuración del proyecto. Generar esos archivos es un paso distinto de publicarlos en un servicio de hosting. [Referencia: Angular CLI](https://angular.dev/tools/cli).

## 6. El recorrido desde el código hasta la pantalla

```text
Tu computadora de desarrollo
  TypeScript + plantillas HTML + CSS
                 |
       Angular CLI, usando Node
                 |
     JavaScript + HTML + CSS preparados
                 |
        Servidor de desarrollo o hosting
                 |
             Navegador
       muestra la UI y ejecuta la lógica
```

El navegador construye una representación de los elementos HTML llamada DOM y aplica los estilos CSS. Angular coordina esos elementos con el estado y los eventos de tus componentes.

Supabase es otra pieza: un servicio remoto al que la aplicación solicita datos. El servidor de desarrollo no es Supabase. Más adelante NestJS sería otro backend, con una responsabilidad diferente a la de Angular CLI.

## 7. Los archivos que encontrarás

| Archivo | Cómo leerlo viniendo de Flutter |
|---|---|
| `src/main.ts` | Punto de arranque, parecido a `main.dart` |
| `src/app/app.routes.ts` | Configuración de rutas, como la de go_router |
| `src/styles.css` | Estilos y tokens compartidos, relacionados con el tema visual |
| `angular.json` | Configuración de cómo servir y construir la aplicación |
| `tsconfig.json` | Reglas del compilador de TypeScript |
| `src/index.html` | Documento HTML que aloja la aplicación |

El componente raíz se monta dentro del documento HTML. Desde allí aparecen layouts y páginas, como una aplicación Flutter que empieza en su widget raíz.

## 8. Cómo leer los comandos sin mezclarlos

```bash
npm install
npm start
npm run build
npm run pdf -- docs/lessons/fundamentos/F00-mapa-ecosistema-web.md
```

Son ejemplos de tareas diferentes: instalar paquetes, servir la app, construirla y generar documentación. El `--` del último comando permite pasar la ruta de la lección al script de PDF.

Cuando leas un error, identifica qué pieza lo emite: npm puede fallar instalando paquetes; TypeScript puede rechazar un tipo; Angular puede detectar un problema en una plantilla; el navegador puede mostrar un error al ejecutar la página. Reconocer esa capa ayuda a buscar la causa, igual que distingues un error de pub de una excepción dentro de un widget.

La siguiente lección, F01, se concentra en el lenguaje: variables, tipos y funciones de TypeScript vistos desde Dart.
