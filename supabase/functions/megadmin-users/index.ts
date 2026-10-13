// Edge Function: megadmin-users
//
// Solo puede usarla un usuario cuyo `perfiles.rol == 'megadmin'`. Corre con
// SUPABASE_SERVICE_ROLE_KEY (nunca expuesta al cliente Flutter) para:
//   - listar todos los perfiles ({ action: "list" })
//   - resetear la contraseña de cualquier usuario sin depender de email
//     ({ action: "reset_password", userId, newPassword })
//
// Deploy: supabase functions deploy megadmin-users
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

    // Cliente admin: bypassa RLS, es el único que toca auth.admin.*
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerProfile, error: profileError } = await adminClient
      .from("perfiles")
      .select("rol")
      .eq("id", callerId)
      .single();

    if (profileError || callerProfile?.rol !== "megadmin") {
      return json({ error: "Requiere rol megadmin." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "list") {
      const { data, error } = await adminClient
        .from("perfiles")
        .select("id, nombre, sucursal, rol")
        .order("nombre", { ascending: true });

      if (error) return json({ error: error.message }, 500);

      // `perfiles` no tiene email; se completa desde auth.users (admin API).
      const { data: authUsers, error: authError } = await adminClient.auth
        .admin.listUsers({ perPage: 1000 });
      if (authError) return json({ error: authError.message }, 500);

      const emailById = new Map(
        authUsers.users.map((u) => [u.id, u.email ?? null]),
      );
      const users = (data ?? []).map((p) => ({
        ...p,
        email: emailById.get(p.id) ?? null,
      }));

      return json({ users });
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

      await adminClient.from("audit_logs").insert({
        action: "reset_password",
        entity: "perfiles",
        entity_id: userId,
        user_email: userData.user.email ?? callerId,
        detail: { via: "megadmin-users" },
      });

      return json({ ok: true });
    }

    return json({ error: `Acción desconocida: ${action}` }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
