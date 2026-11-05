# L20: Gestión de usuarios y operaciones privilegiadas

**Idea central:** administrar usuarios requiere una pantalla sencilla y una decisión de autorización en el servidor. El navegador nunca necesita recibir la clave privilegiada de Supabase.

Solo teoría comparada con Flutter/Riverpod. Implementación publicada en `53e72de`; Flutter de referencia `7d3fa5f`. La prueba API y las pruebas reportadas por Claude se documentan en `docs/status.md`; la prueba frontend final no estaba registrada en la consolidación previa.

## 1. Qué cambia respecto a Flutter

Flutter `UsersManagementView` lista usuarios y permite restablecer contraseñas mediante su notifier y repositorio. Angular mantiene esas operaciones y agrega crear, editar y activar/desactivar, por pedido del dueño. La ruta está reservada a megadmin.

| Flutter | Angular |
|---|---|
| `UsersManagement` con `copyWith` | `UsersStore` y signals de estado |
| Tarjetas y diálogo de contraseña | tabla y diálogos de formulario y contraseña |
| Listar y restablecer contraseña | añade alta, edición y estado activo |
| Repositorio de administración | `UserAdminRepository` y Edge Function `megadmin-users` |

## 2. Página, estado y contratos

La página provee `UsersStore`: cada visita tiene su estado. El store expone usuarios, carga, error y si terminó la primera lectura. Tras crear, editar o cambiar el estado, recarga la lista cuando la operación tuvo éxito. Sus métodos devuelven `Result`, semejante al `Either` que el notifier Flutter procesa con `fold`.

`NewManagedUser` contiene nombre, sucursal, rol, correo y contraseña; `ManagedUserEdit` contiene nombre, sucursal y rol. Separar ambos tipos hace visible que editar el perfil no es el mismo formulario que crear una cuenta o restablecer una contraseña.

## 3. La frontera de seguridad

El guard de ruta evita la navegación normal de quien no tiene rol, pero no reemplaza la validación en servidor. `megadmin-users` comprueba la identidad y el rol `megadmin` antes de ejecutar acciones administrativas con un cliente privilegiado del servidor. La clave de servicio no se incorpora al navegador.

La función recibe acciones explícitas: `list`, `create`, `update`, `set_active` y `reset_password`. Comprueba datos y reglas también del lado servidor. La interfaz puede mostrar errores de validación antes, pero una solicitud directa debe pasar las mismas restricciones del servidor.

## 4. Desactivar conserva la historia

Desactivar aplica un bloqueo reversible de Supabase Auth; activar lo retira. No equivale a borrar el perfil ni los registros relacionados: ventas y auditoría pueden seguir apuntando al mismo usuario. Se impide desactivarse a sí mismo o cambiarse el rol de megadmin, y se intenta conservar al menos un megadmin activo.

El alta usa correo y contraseña proporcionados; la invitación por correo con SMTP queda fuera del alcance actual. La lista no pagina: es una decisión para un conjunto pequeño de usuarios, no una garantía de escalabilidad ilimitada.

## 5. Evidencia y fuentes

Código: `features/users/`, `core/repositories/user-admin.repository.ts` y `supabase/functions/megadmin-users/`. Flutter: [vista y notifier](https://github.com/MeloGon/oftal_web/tree/7d3fa5f/lib/features/settings). La comprobación documental no modifica Auth ni vuelve a ejecutar operaciones sobre usuarios reales.

```bash
npm run pdf -- docs/lessons/20-usuarios.md
```
