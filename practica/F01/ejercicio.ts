// F01 · Ejercicio: TypeScript desde Dart
// Lección: docs/lessons/fundamentos/F01-typescript-desde-dart.md
//
// Completa las 4 funciones que dicen TODO. No toques la parte de abajo ("Pruebas").
// Correr:            node practica/F01/ejercicio.ts
// Revisar tipos:     npx tsc --noEmit --strict --ignoreConfig practica/F01/ejercicio.ts

// ---------------------------------------------------------------------------
// 1. Escribe una función `saludar` que reciba un nombre (string) y devuelva
//    el texto "Hola, <nombre>". Usa comillas invertidas y ${ }.
//    En Dart sería:  String saludar(String nombre) => 'Hola, $nombre';
// TODO
function saludar(name:String) : String{
  return `Hola, ${name}`;
} 
// ---------------------------------------------------------------------------
// 2. Escribe una función `nombreOVacio` que reciba un nombre que PUEDE SER null
//    y devuelva el nombre, o "Sin nombre" si es null.
//    En Dart sería:  String nombreOVacio(String? nombre) => nombre ?? 'Sin nombre';
// TODO
function nombreOVacio(name?:String | null){
  if(name === null)
    return "Sin nombre";
  return name;
}

// ---------------------------------------------------------------------------
// 3. Escribe una función `soloAltas` que reciba una lista de números (graduaciones)
//    y devuelva solo las que sean mayores o iguales a 2.
//    En Dart sería:  List<double> soloAltas(List<double> l) => l.where((x) => x >= 2).toList();
// TODO
function soloAltas(listNumbers:number[] ): number[]{
 return listNumbers.filter((x) => x >=2);
 
}

// ---------------------------------------------------------------------------
// 4. Escribe una función `esAdmin` que reciba un rol (string) y devuelva true
//    si el rol es "admin" o "megadmin". Usa ===.
// TODO
function esAdmin(role:String) :boolean{
  if(role == "admin" || role == "megadmin"){
    return true;
  }
  return false;
}

// ===========================================================================
// Pruebas (no tocar). Cada línea imprime ✅ o ❌.
// ===========================================================================
function probar(nombre: string, obtenido: unknown, esperado: unknown): void {
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado);
  console.log(`${ok ? '✅' : '❌'} ${nombre}${ok ? '' : `  → obtuve ${JSON.stringify(obtenido)}, esperaba ${JSON.stringify(esperado)}`}`);
}

probar('saludar', saludar('Ana'), 'Hola, Ana');
probar('nombreOVacio con nombre', nombreOVacio('Luis'), 'Luis');
probar('nombreOVacio con null', nombreOVacio(null), 'Sin nombre');
probar('soloAltas', soloAltas([0.5, 2, -1.25, 3.75]), [2, 3.75]);
probar('esAdmin admin', esAdmin('admin'), true);
probar('esAdmin megadmin', esAdmin('megadmin'), true);
probar('esAdmin vendedor', esAdmin('vendedor'), false);
