// Edge Function: megadmin-users
//
// Solo puede usarla un usuario cuyo `perfiles.rol == 'megadmin'`. Corre con
// SUPABASE_SERVICE_ROLE_KEY (nunca expuesta al cliente) para:
//   - listar todos los perfiles, con último acceso y si están activos ({ action: "list" })
//   - crear un usuario nuevo ({ action: "create", nombre, sucursal, rol, email, password })
//   - editar nombre/sucursal/rol de uno existente ({ action: "update", userId, nombre, sucursal, rol })
//   - activar/desactivar el acceso, sin borrar nada ({ action: "set_active", userId, active })
//   - resetear la contraseña de cualquier usuario sin depender de email
//     ({ action: "reset_password", userId, newPassword })
//   - dar de alta una empresa nueva con su primera sucursal y su usuario admin
//     ({ action: "create_organization", nombre, sucursal, adminNombre, adminEmail, adminPassword })
//
// Multi-empresa: cada perfil pertenece a una organización. Al crear, `organizacionId` (opcional;
// por defecto la del megadmin que llama) viaja en `user_metadata` para que `handle_new_user` cree
// el perfil en esa empresa, y `sucursal` debe existir en ella. Las filas de auditoría llevan la
// organización del usuario afectado.
//
// "Desactivar" nunca borra: usa el ban de Supabase Auth (reversible), porque el usuario puede
// tener ventas, egresos o auditoría encadenados a su id (mismo criterio que archivar paciente).
//
// Deploy: supabase functions deploy megadmin-users
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ROLES = ["vendedor", "supervisor", "admin", "megadmin"];
// Más que cualquier sesión real: equivale a "desactivado" sin fecha de vuelta.
const BAN_FOREVER = "876000h";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isBanned(bannedUntil: string | null | undefined): boolean {
  if (!bannedUntil) return false;
  const until = new Date(bannedUntil).getTime();
  return !Number.isNaN(until) && until > Date.now();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Falta el header Authorization." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Cliente "de usuario": solo sirve para validar quién llama.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await callerClient.auth
      .getUser();
    if (userError || !userData?.user) {
      return json({ error: "Token inválido o expirado." }, 401);
    }
    const callerId = userData.user.id;
    const callerEmail = userData.user.email ?? callerId;

    // Cliente admin: bypassa RLS, es el único que toca auth.admin.*
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerProfile, error: profileError } = await adminClient
      .from("perfiles")
      .select("rol, organizacion_id")
      .eq("id", callerId)
      .single();

    if (profileError || callerProfile?.rol !== "megadmin") {
      return json({ error: "Requiere rol megadmin." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    async function logAction(
      action: string,
      entityId: string,
      detail: Record<string, unknown>,
      organizacionId: string | null,
    ) {
      await adminClient.from("audit_logs").insert({
        action,
        entity: "perfiles",
        entity_id: entityId,
        user_email: callerEmail,
        organizacion_id: organizacionId,
        detail,
      });
    }

    /** Organización de un perfil (para auditar y para validar la sucursal). */
    async function orgOf(userId: string): Promise<string | null> {
      const { data } = await adminClient
        .from("perfiles")
        .select("organizacion_id")
        .eq("id", userId)
        .single();
      return (data?.organizacion_id as string | undefined) ?? null;
    }

    /** `null` si la sucursal es válida en esa organización (o no se pidió ninguna). */
    async function sucursalError(
      sucursal: string | null,
      orgId: string,
    ): Promise<string | null> {
      if (!sucursal) return null;
      const { data } = await adminClient
        .from("sucursales")
        .select("id")
        .eq("organizacion_id", orgId)
        .eq("nombre", sucursal)
        .maybeSingle();
      return data ? null : "Esa sucursal no existe en la empresa del usuario.";
    }

    /** Megadmins activos, sin contar `excludingUserId` (para "¿quedaría alguno si hago esto?"). */
    async function activeMegadminsExcluding(
      excludingUserId: string | null,
    ): Promise<number> {
      const { data: megadmins } = await adminClient
        .from("perfiles")
        .select("id")
        .eq("rol", "megadmin");
      const ids = (megadmins ?? [])
        .map((m) => m.id as string)
        .filter((id) => id !== excludingUserId);
      if (ids.length === 0) return 0;

      const { data: authUsers } = await adminClient.auth.admin.listUsers({
        perPage: 1000,
      });
      const bannedById = new Map(
        authUsers?.users.map((u) => [u.id, isBanned(u.banned_until)]) ?? [],
      );
      return ids.filter((id) => !bannedById.get(id)).length;
    }

    if (action === "list") {
      const { data, error } = await adminClient
        .from("perfiles")
        .select("id, nombre, sucursal, rol, organizacion_id")
        .order("nombre", { ascending: true });

      if (error) return json({ error: error.message }, 500);

      // `perfiles` no tiene email ni último acceso; se completa desde auth.users (admin API).
      const { data: authUsers, error: authError } = await adminClient.auth
        .admin.listUsers({ perPage: 1000 });
      if (authError) return json({ error: authError.message }, 500);

      const byId = new Map(authUsers.users.map((u) => [u.id, u]));
      const users = (data ?? []).map((p) => {
        const authUser = byId.get(p.id);
        return {
          ...p,
          email: authUser?.email ?? null,
          last_sign_in_at: authUser?.last_sign_in_at ?? null,
          active: !isBanned(authUser?.banned_until),
        };
      });

      return json({ users });
    }

    if (action === "create") {
      const nombre = body?.nombre;
      const sucursal = body?.sucursal || null;
      const rol = body?.rol;
      const email = body?.email;
      const password = body?.password;

      if (typeof nombre !== "string" || !nombre.trim()) {
        return json({ error: "El nombre es requerido." }, 400);
      }
      if (typeof rol !== "string" || !ROLES.includes(rol)) {
        return json({ error: "Rol inválido." }, 400);
      }
      if (typeof email !== "string" || !email.includes("@")) {
        return json({ error: "Correo inválido." }, 400);
      }
      if (typeof password !== "string" || password.length < 6) {
        return json(
          { error: "La contraseña debe tener al menos 6 caracteres." },
          400,
        );
      }

      const organizacionId: string = body?.organizacionId ??
        callerProfile.organizacion_id;
      const { data: org } = await adminClient
        .from("organizaciones")
        .select("id")
        .eq("id", organizacionId)
        .maybeSingle();
      if (!org) return json({ error: "La empresa no existe." }, 400);
      const sucError = await sucursalError(sucursal, organizacionId);
      if (sucError) return json({ error: sucError }, 400);

      // `organizacion_id` en user_metadata: `handle_new_user` lo usa para crear el perfil.
      const { data: created, error: createError } = await adminClient.auth
        .admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { organizacion_id: organizacionId },
        });
      if (createError) return json({ error: createError.message }, 500);

      const newUserId = created.user.id;
      // El trigger on_auth_user_created ya insertó la fila en perfiles (rol 'vendedor'
      // por defecto); se completa con los datos reales del formulario.
      const { error: updateError } = await adminClient.from("perfiles")
        .update({ nombre: nombre.trim(), sucursal, rol }).eq("id", newUserId);
      if (updateError) return json({ error: updateError.message }, 500);

      await logAction(
        "create_user",
        newUserId,
        { nombre, sucursal, rol, email },
        organizacionId,
      );
      return json({
        user: {
          id: newUserId,
          nombre,
          sucursal,
          rol,
          organizacion_id: organizacionId,
          email,
          last_sign_in_at: null,
          active: true,
        },
      });
    }

    if (action === "update") {
      const userId = body?.userId;
      const nombre = body?.nombre;
      const sucursal = body?.sucursal || null;
      const rol = body?.rol;

      if (typeof userId !== "string") {
        return json({ error: "userId es requerido." }, 400);
      }
      if (typeof nombre !== "string" || !nombre.trim()) {
        return json({ error: "El nombre es requerido." }, 400);
      }
      if (typeof rol !== "string" || !ROLES.includes(rol)) {
        return json({ error: "Rol inválido." }, 400);
      }

      const { data: target } = await adminClient
        .from("perfiles")
        .select("rol, organizacion_id")
        .eq("id", userId)
        .single();
      if (!target) return json({ error: "Usuario no encontrado." }, 404);

      const sucError = await sucursalError(
        sucursal,
        target.organizacion_id as string,
      );
      if (sucError) return json({ error: sucError }, 400);

      if (userId === callerId && rol !== "megadmin") {
        return json({ error: "No puedes cambiar tu propio rol de megadmin." }, 400);
      }
      if (target.rol === "megadmin" && rol !== "megadmin") {
        const remaining = await activeMegadminsExcluding(userId);
        if (remaining === 0) {
          return json({ error: "Debe quedar al menos un megadmin activo." }, 400);
        }
      }

      const { error: updateError } = await adminClient.from("perfiles")
        .update({ nombre: nombre.trim(), sucursal, rol }).eq("id", userId);
      if (updateError) return json({ error: updateError.message }, 500);

      await logAction(
        "update_user",
        userId,
        { nombre, sucursal, rol, old_rol: target.rol },
        target.organizacion_id as string,
      );
      return json({ ok: true });
    }

    if (action === "create_organization") {
      const nombre = body?.nombre;
      const sucursal = body?.sucursal;
      const adminNombre = body?.adminNombre;
      const adminEmail = body?.adminEmail;
      const adminPassword = body?.adminPassword;

      if (typeof nombre !== "string" || !nombre.trim()) {
        return json({ error: "El nombre de la empresa es requerido." }, 400);
      }
      if (typeof sucursal !== "string" || !sucursal.trim()) {
        return json({ error: "La primera sucursal es requerida." }, 400);
      }
      if (typeof adminNombre !== "string" || !adminNombre.trim()) {
        return json({ error: "El nombre del administrador es requerido." }, 400);
      }
      if (typeof adminEmail !== "string" || !adminEmail.includes("@")) {
        return json({ error: "Correo inválido." }, 400);
      }
      if (typeof adminPassword !== "string" || adminPassword.length < 6) {
        return json(
          { error: "La contraseña debe tener al menos 6 caracteres." },
          400,
        );
      }

      // La empresa se crea con la sesión de quien llama: la función SQL exige megadmin y deja la
      // auditoría a su nombre.
      const { data: orgId, error: orgError } = await callerClient.rpc(
        "crear_organizacion",
        { p_nombre: nombre, p_sucursal: sucursal },
      );
      if (orgError || !orgId) {
        return json({ error: orgError?.message ?? "No se pudo crear la empresa." }, 400);
      }

      // Si el administrador no se puede crear (p. ej. el correo ya existe), se deshace la empresa
      // para no dejar una empresa sin dueño.
      async function undoOrganization() {
        await adminClient.from("audit_logs").delete().eq("organizacion_id", orgId);
        await adminClient.from("app_config").delete().eq("organizacion_id", orgId);
        await adminClient.from("sucursales").delete().eq("organizacion_id", orgId);
        await adminClient.from("organizaciones").delete().eq("id", orgId);
      }

      const { data: created, error: createError } = await adminClient.auth.admin
        .createUser({
          email: adminEmail,
          password: adminPassword,
          email_confirm: true,
          user_metadata: { organizacion_id: orgId },
        });
      if (createError || !created?.user) {
        await undoOrganization();
        return json({ error: createError?.message ?? "No se pudo crear el administrador." }, 400);
      }

      const sucursalNombre = sucursal.trim().replace(/\s+/g, " ").toUpperCase();
      const { error: updateError } = await adminClient.from("perfiles")
        .update({ nombre: adminNombre.trim(), sucursal: sucursalNombre, rol: "admin" })
        .eq("id", created.user.id);
      if (updateError) {
        await adminClient.auth.admin.deleteUser(created.user.id);
        await undoOrganization();
        return json({ error: updateError.message }, 500);
      }

      await logAction(
        "create_user",
        created.user.id,
        { nombre: adminNombre, sucursal: sucursalNombre, rol: "admin", email: adminEmail },
        orgId as string,
      );
      return json({
        organization: { id: orgId, nombre: nombre.trim(), sucursal: sucursalNombre },
        admin: { id: created.user.id, email: adminEmail },
      });
    }

    if (action === "set_active") {
      const userId = body?.userId;
      const active = body?.active;

      if (typeof userId !== "string" || typeof active !== "boolean") {
        return json({ error: "userId y active son requeridos." }, 400);
      }

      if (!active) {
        if (userId === callerId) {
          return json({ error: "No puedes desactivarte a ti mismo." }, 400);
        }
        const { data: target } = await adminClient
          .from("perfiles")
          .select("rol")
          .eq("id", userId)
          .single();
        if (target?.rol === "megadmin") {
          const remaining = await activeMegadminsExcluding(userId);
          if (remaining === 0) {
            return json({ error: "Debe quedar al menos un megadmin activo." }, 400);
          }
        }
      }

      const { error: updateError } = await adminClient.auth.admin
        .updateUserById(userId, { ban_duration: active ? "none" : BAN_FOREVER });
      if (updateError) return json({ error: updateError.message }, 500);

      await logAction(
        active ? "activate_user" : "deactivate_user",
        userId,
        {},
        await orgOf(userId),
      );
      return json({ ok: true });
    }

    if (action === "reset_password") {
      const userId = body?.userId;
      const newPassword = body?.newPassword;

      if (typeof userId !== "string" || typeof newPassword !== "string") {
        return json({ error: "userId y newPassword son requeridos." }, 400);
      }
      if (newPassword.length < 6) {
        return json(
          { error: "La contraseña debe tener al menos 6 caracteres." },
          400,
        );
      }

      const { error: updateError } = await adminClient.auth.admin
        .updateUserById(userId, { password: newPassword });
      if (updateError) return json({ error: updateError.message }, 500);

      await logAction(
        "reset_password",
        userId,
        { via: "megadmin-users" },
        await orgOf(userId),
      );
      return json({ ok: true });
    }

    return json({ error: `Acción desconocida: ${action}` }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
