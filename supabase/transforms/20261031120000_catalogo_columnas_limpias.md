# Transform: columnas limpias de armazones, resinas y vendedores (cambio #9)

Solo renombres de columna y 3 columnas eliminadas; ningún dato cambia de forma
(a diferencia de pacientes #3/#4 o revisiones #7, no hay valores que reinterpretar).
En DEV las 3 tablas estaban vacías al aplicar; el mapeo se verificó leyendo PROD
(solo lectura) antes de escribir la migración.

## armazones

| Columna vieja | Columna nueva | Nota |
|---|---|---|
| `"ID ARMAZON"` | `id` | PK, sin cambio de tipo (bigint). Sigue sin secuencia: no hace falta para E2.6 (solo lee y descuenta stock); si una futura feature de inventario necesita insertar armazones, se agrega identity ahí |
| `"MARCA"` | `marca` | |
| `"MODELO"` | `modelo` | |
| `"COLOR"` | `color` | |
| `"DESCRIPCION"` | `descripcion` | |
| `"PRECIO"` | `precio` | |
| `"NOMBRE DE LA OPTICA"` | `sucursal` | mismo nombre de columna que `pacientes`/`revisiones`/`ventas`/`egresos` |
| `"CODIGO DE BARRAS"` | `codigo_barras` | duplicados existen en PROD (1,666 valores distintos en 2,952 filas); no se agrega `UNIQUE` |
| `"EXISTENCIAS"` | `existencias` | stock; 0–119 en PROD, sin nulos |
| `"CREADO EL"` | `creado_el` | |
| `"FECHA DE REGISTRO"` | `fecha_registro_legado` | texto en español abreviado (`"09-sept-24"`), formato irregular; ninguna pantalla de Flutter ni de Angular la usa. Se respalda sin parsear, igual criterio que `fecha_legado` del cambio #8 |
| `"Expr1010"` | — (eliminada) | siempre `"FALSO"` o `null` en las 2,952 filas de PROD; resto de un import de Access |
| `"PROVEEDOR"` | — (eliminada) | casi siempre `"0"`, `""` o `null`; una fila con un valor en notación científica rota (`"1,80817E+11"`); sin información real |
| `"CONSIGNACION"` | — (eliminada) | siempre `"FALSO"` en las 2,952 filas de PROD |

Verificación en PROD antes de aplicar (solo lectura):
```sql
select "Expr1010", "PROVEEDOR", "CONSIGNACION", count(*) from armazones group by 1,2,3;
-- 5 combinaciones, todas "FALSO"/"0"/vacío/null salvo 1 fila con un número roto en PROVEEDOR.
select count(*), count("ID ARMAZON"), count(distinct "ID ARMAZON"), count("CODIGO DE BARRAS"),
       count(distinct "CODIGO DE BARRAS"), min("EXISTENCIAS"), max("EXISTENCIAS")
from armazones;
-- 2952 filas, id y precio/existencias sin nulos.
```

## resinas

| Columna vieja | Columna nueva | Nota |
|---|---|---|
| `"CREADO EL"` | `creado_el` | |
| `"diseño"` (con tilde) | `diseno` | mismo nombre que ya usa `venta_items.diseno` desde el cambio #8 |

## vendedores

| Columna vieja | Columna nueva | Nota |
|---|---|---|
| `"NOMBRE"` | `nombre` | |

## Pendiente

Ninguno de los tres repositorios Angular (`MountRepository`, `ResinRepository`,
`SellerRepository`) existía antes de este cambio; se agregan junto con E2.6.
`armazones` sigue sin CRUD de alta/edición (eso es E2.8 Settings, no E2.6): el
inventario se sigue cargando directo en la base hasta que exista esa pantalla.
