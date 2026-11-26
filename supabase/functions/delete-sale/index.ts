// Edge Function: delete-sale
//
// Eliminar una venta (pedido del dueño, 2026-11-25):
//   - supervisor, admin y megadmin: directo (la app pide confirmación).
//   - vendedor: necesita el correo y contraseña de un supervisor+ de su empresa (P-04); se
//     verifican aquí, sin tocar la sesión del vendedor en el navegador.
//
// Multi-empresa: la venta debe ser de la misma empresa que quien llama (un megadmin puede con
// cualquiera) y el supervisor que autoriza también; si no, responde "no existe".
//
// El borrado lo hace `public.delete_sale` (migración 20261125120000) en una sola transacción:
// devuelve el stock de armazones, borra pagos y venta (las líneas caen en cascada) y deja en
// `audit_logs` quién eliminó y quién autorizó. Esa función solo la puede llamar `service_role`.
// Mismo molde que `patients-lifecycle`.
//
// Deploy: supabase functions deploy delete-sale
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ROLES = ["vendedor", "supervisor", "admin", "megadmin"];
const hasRole = (role: string, min: string) =>
  ROLES.indexOf(role) >= ROLES.indexOf(min);

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
    const callerEmail = userData.user.email ?? callerId;

    // Cliente admin: bypassa RLS; es el único que puede llamar a delete_sale.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerProfile, error: profileError } = await adminClient
      .from("perfiles")
      .select("rol, organizacion_id")
      .eq("id", callerId)
      .single();
    if (profileError || !callerProfile) {
      return json({ error: "No se encontró tu perfil." }, 403);
    }
    const callerRole = callerProfile.rol as string;

    const body = await req.json().catch(() => ({}));
    const saleId = body?.saleId;
    if (typeof saleId !== "string" || !saleId) {
      return json({ error: "saleId es requerido." }, 400);
    }

    // Empresa de la venta; si es de otra empresa se trata como inexistente.
    const { data: sale } = await adminClient
      .from("ventas")
      .select("organizacion_id")
      .eq("id", saleId)
      .maybeSingle();
    if (
      !sale ||
      (callerRole !== "megadmin" &&
        sale.organizacion_id !== callerProfile.organizacion_id)
    ) {
      return json({ error: "La venta ya no existe." }, 404);
    }

    let authorizedBy: string | null = null;
    if (!hasRole(callerRole, "supervisor")) {
      const email = body?.supervisorEmail;
      const password = body?.supervisorPassword;
      if (typeof email !== "string" || typeof password !== "string") {
        return json({ error: "needs_supervisor" }, 400);
      }

      // Cliente nuevo y descartable: valida la contraseña del supervisor sin tocar la
      // sesión (del vendedor) que llegó en el header Authorization.
      const supervisorClient = createClient(supabaseUrl, anonKey);
      const { data: signIn, error: signInError } = await supervisorClient.auth
        .signInWithPassword({ email, password });
      if (signInError || !signIn?.user) {
        return json({ error: "Correo o contraseña incorrectos." }, 401);
      }

      const { data: supervisorProfile } = await adminClient
        .from("perfiles")
        .select("rol, organizacion_id")
        .eq("id", signIn.user.id)
        .single();
      if (
        !supervisorProfile || !hasRole(supervisorProfile.rol, "supervisor")
      ) {
        return json({ error: "Esa cuenta no tiene permiso de supervisor." }, 403);
      }
      if (
        supervisorProfile.rol !== "megadmin" &&
        supervisorProfile.organizacion_id !== sale.organizacion_id
      ) {
        return json({ error: "Ese supervisor es de otra empresa." }, 403);
      }
      authorizedBy = signIn.user.email ?? signIn.user.id;
    }

    const { data, error } = await adminClient.rpc("delete_sale", {
      p_id: saleId,
      p_actor_email: callerEmail,
      p_authorized_by: authorizedBy,
    });
    if (error) {
      const status = error.code === "P0002" ? 404 : 500;
      return json({ error: error.message }, status);
    }
    return json({ ok: true, ...data });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
