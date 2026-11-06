// Edge Function: authorize-discount
//
// P-04 en Vender. Cuando la sucursal exige autorización para descontar, el vendedor pide a un
// supervisor+ su correo y contraseña. Aquí se verifican (sin tocar la sesión del vendedor) y,
// si son válidas, se deja una fila en `descuento_autorizaciones`: de un solo uso, de hasta
// `amount` y con vencimiento de 10 minutos. El trigger `trg_ventas_descuento` la consume al
// insertar la venta; sin esa fila, el servidor rechaza la venta aunque el navegador mienta.
//
// Reglas del que autoriza: supervisor de la MISMA sucursal que el vendedor, o admin/megadmin
// de cualquiera. Todo queda en `audit_logs`.
//
// Mismo molde que `patients-lifecycle`. Deploy: supabase functions deploy authorize-discount
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

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerProfile } = await adminClient
      .from("perfiles")
      .select("rol, sucursal")
      .eq("id", callerId)
      .single();
    if (!callerProfile) {
      return json({ error: "No se encontró tu perfil." }, 403);
    }
    if (hasRole(callerProfile.rol, "supervisor")) {
      // Supervisor+ descuenta directo: no necesita (ni debe generar) autorizaciones.
      return json({ error: "Tu rol ya puede aplicar descuentos directo." }, 400);
    }

    const body = await req.json().catch(() => ({}));
    const email = body?.supervisorEmail;
    const password = body?.supervisorPassword;
    const amount = Number(body?.amount);
    if (typeof email !== "string" || typeof password !== "string") {
      return json({ error: "Correo y contraseña son requeridos." }, 400);
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ error: "El monto del descuento no es válido." }, 400);
    }

    // Cliente nuevo y descartable: valida la contraseña sin tocar la sesión del vendedor.
    const supervisorClient = createClient(supabaseUrl, anonKey);
    const { data: signIn, error: signInError } = await supervisorClient.auth
      .signInWithPassword({ email, password });
    if (signInError || !signIn?.user) {
      return json({ error: "Correo o contraseña incorrectos." }, 401);
    }

    const { data: supervisorProfile } = await adminClient
      .from("perfiles")
      .select("rol, sucursal")
      .eq("id", signIn.user.id)
      .single();
    if (
      !supervisorProfile || !hasRole(supervisorProfile.rol, "supervisor")
    ) {
      return json({ error: "Esa cuenta no tiene permiso de supervisor." }, 403);
    }
    if (
      !hasRole(supervisorProfile.rol, "admin") &&
      supervisorProfile.sucursal !== callerProfile.sucursal
    ) {
      return json(
        { error: "Ese supervisor es de otra sucursal." },
        403,
      );
    }

    const { data: auth, error: insertError } = await adminClient
      .from("descuento_autorizaciones")
      .insert({
        vendedor_id: callerId,
        autorizado_por: signIn.user.id,
        monto: amount,
      })
      .select("expira_en")
      .single();
    if (insertError || !auth) {
      return json({ error: insertError?.message ?? "No se pudo autorizar." }, 500);
    }

    await adminClient.from("audit_logs").insert({
      action: "authorize_discount",
      entity: "ventas",
      entity_id: callerId,
      user_email: callerEmail,
      detail: {
        amount,
        authorizedBy: signIn.user.email ?? signIn.user.id,
        authorizedRole: supervisorProfile.rol,
        branch: callerProfile.sucursal,
      },
    });

    return json({ ok: true, expiresAt: auth.expira_en });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
