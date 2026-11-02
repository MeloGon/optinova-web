// Edge Function: patients-lifecycle
//
// Eliminar/archivar un paciente según su historial (decisión del dueño, 2026-10-26):
//   - sin revisiones ni ventas: cualquier rol, se borra.
//   - con revisiones (sin ventas): supervisor+ lo borra directo; un vendedor necesita el correo
//     y contraseña de un supervisor+ (P-04) — se verifican aquí, sin tocar la sesión del vendedor
//     en el navegador — y se borran paciente y revisiones.
//   - con ventas (o pagos, que cuelgan de una venta): no se borra, se archiva (`archivado_en`/
//     `archivado_por`); solo admin+. Se puede restaurar.
//
// El nivel SIEMPRE se recalcula aquí (nunca se confía en lo que mande el cliente). Toda acción
// quede en `audit_logs`. Mismo molde que `megadmin-users`: cliente "caller" (valida el token de
// quien llama) + cliente `service_role` (bypassa RLS, el único que puede borrar/archivar).
//
// Deploy: supabase functions deploy patients-lifecycle
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

interface Tier {
  tier: "none" | "reviews" | "sales";
  reviewCount: number;
  saleCount: number;
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

    // Cliente admin: bypassa RLS, es el único que borra/archiva.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerProfile, error: profileError } = await adminClient
      .from("perfiles")
      .select("rol")
      .eq("id", callerId)
      .single();
    if (profileError || !callerProfile) {
      return json({ error: "No se encontró tu perfil." }, 403);
    }
    const callerRole = callerProfile.rol as string;

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const patientId = body?.patientId;
    if (typeof patientId !== "string" || !patientId) {
      return json({ error: "patientId es requerido." }, 400);
    }

    async function resolveTier(): Promise<Tier> {
      const [reviews, sales] = await Promise.all([
        adminClient
          .from("revisiones")
          .select("id", { count: "exact", head: true })
          .eq("paciente_id", patientId),
        adminClient
          .from("ventas")
          .select("id", { count: "exact", head: true })
          .eq("paciente_id", patientId),
      ]);
      const reviewCount = reviews.count ?? 0;
      const saleCount = sales.count ?? 0;
      const tier: Tier["tier"] = saleCount > 0
        ? "sales"
        : reviewCount > 0
        ? "reviews"
        : "none";
      return { tier, reviewCount, saleCount };
    }

    async function audit(action: string, detail: Record<string, unknown>) {
      await adminClient.from("audit_logs").insert({
        action,
        entity: "pacientes",
        entity_id: patientId,
        user_email: callerEmail,
        detail,
      });
    }

    if (action === "resolve") {
      return json(await resolveTier());
    }

    if (action === "apply") {
      const { data: patient } = await adminClient
        .from("pacientes")
        .select("id")
        .eq("id", patientId)
        .single();
      if (!patient) return json({ error: "El paciente ya no existe." }, 404);

      const { tier, reviewCount, saleCount } = await resolveTier();

      if (tier === "none") {
        const { error } = await adminClient.from("pacientes").delete().eq(
          "id",
          patientId,
        );
        if (error) return json({ error: error.message }, 500);
        await audit("delete_patient", { tier, reviewCount, saleCount });
        return json({ ok: true, result: "deleted" });
      }

      if (tier === "reviews") {
        let authorizedBy: string | null = null;
        let authorizedRole: string | null = null;

        if (!hasRole(callerRole, "supervisor")) {
          const email = body?.supervisorEmail;
          const password = body?.supervisorPassword;
          if (typeof email !== "string" || typeof password !== "string") {
            return json({ error: "needs_supervisor", tier, reviewCount }, 400);
          }

          // Cliente nuevo y descartable: valida la contraseña del supervisor sin tocar la
          // sesión (del vendedor) que llegó en el header Authorization.
          const supervisorClient = createClient(supabaseUrl, anonKey);
          const { data: signIn, error: signInError } = await supervisorClient
            .auth.signInWithPassword({ email, password });
          if (signInError || !signIn?.user) {
            return json({ error: "Correo o contraseña incorrectos." }, 401);
          }

          const { data: supervisorProfile } = await adminClient
            .from("perfiles")
            .select("rol")
            .eq("id", signIn.user.id)
            .single();
          if (
            !supervisorProfile || !hasRole(supervisorProfile.rol, "supervisor")
          ) {
            return json(
              { error: "Esa cuenta no tiene permiso de supervisor." },
              403,
            );
          }
          authorizedBy = signIn.user.email ?? signIn.user.id;
          authorizedRole = supervisorProfile.rol;
        }

        const { error: deleteReviewsError } = await adminClient
          .from("revisiones")
          .delete()
          .eq("paciente_id", patientId);
        if (deleteReviewsError) {
          return json({ error: deleteReviewsError.message }, 500);
        }
        const { error: deletePatientError } = await adminClient
          .from("pacientes")
          .delete()
          .eq("id", patientId);
        if (deletePatientError) {
          return json({ error: deletePatientError.message }, 500);
        }
        await audit("delete_patient", {
          tier,
          reviewCount,
          saleCount,
          authorizedBy,
          authorizedRole,
        });
        return json({ ok: true, result: "deleted" });
      }

      // tier === "sales"
      if (!hasRole(callerRole, "admin")) {
        return json({
          error: "Solo un administrador o superior puede archivar pacientes con ventas.",
        }, 403);
      }
      const { error } = await adminClient
        .from("pacientes")
        .update({ archivado_en: new Date().toISOString(), archivado_por: callerId })
        .eq("id", patientId);
      if (error) return json({ error: error.message }, 500);
      await audit("archive_patient", { tier, reviewCount, saleCount });
      return json({ ok: true, result: "archived" });
    }

    if (action === "restore") {
      if (!hasRole(callerRole, "admin")) {
        return json({
          error: "Solo un administrador o superior puede restaurar pacientes.",
        }, 403);
      }
      const { data, error } = await adminClient
        .from("pacientes")
        .update({ archivado_en: null, archivado_por: null })
        .eq("id", patientId)
        .select("id");
      if (error) return json({ error: error.message }, 500);
      if (!data || data.length === 0) {
        return json({ error: "El paciente ya no existe." }, 404);
      }
      await audit("restore_patient", {});
      return json({ ok: true });
    }

    return json({ error: `Acción desconocida: ${action}` }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
