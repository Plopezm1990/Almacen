import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import {
  filterRecipientSubscriptions,
  userHasTenantScope,
} from "../_shared/tenant-scope.js";

const SITE_HOST = "chic-entremet-9107cf.netlify.app";

const TITULOS_CLIENTE = new Set([
  "Lote caducado",
  "Lote a punto de caducar",
  "Caja descuadrada",
  "Stock bajo",
  "Caja cerrada, ahora desactualizada",
  "Error en el programa",
]);

const TITULOS_INTERNOS = new Set([
  ...TITULOS_CLIENTE,
  "Prefiltro completado",
]);

const TITULOS_CON_LOCAL = new Set([
  "Lote caducado",
  "Lote a punto de caducar",
  "Caja descuadrada",
  "Stock bajo",
  "Caja cerrada, ahora desactualizada",
  "Prefiltro completado",
]);

const ROLES_CAJA = ["Propietario", "Encargado", "Cajero/a"];

const ROLES_DESTINO: Record<string, string[]> = {
  "Prefiltro completado": ["Propietario", "Encargado"],
  "Caja descuadrada": ["Propietario", "Encargado", "Cajero/a"],
  "Caja cerrada, ahora desactualizada": ["Propietario", "Encargado", "Cajero/a"],
  "Stock bajo": ["Propietario", "Encargado", "Churrero/a"],
  "Lote caducado": ["Propietario", "Encargado", "Churrero/a"],
  "Lote a punto de caducar": ["Propietario", "Encargado", "Churrero/a"],
  "Error en el programa": ["Propietario", "Encargado"],
};

function origenPermitido(origen: string) {
  if (!origen) return true;
  try {
    const u = new URL(origen);
    return u.protocol === "https:" &&
      (u.hostname === SITE_HOST || u.hostname.endsWith("--" + SITE_HOST));
  } catch {
    return false;
  }
}

function cors(req: Request) {
  const origen = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": origenPermitido(origen) ? origen : "",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(req: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json" },
  });
}

function clean(v: unknown, max: number) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function sameSecret(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  const origen = req.headers.get("Origin") || "";
  if (req.method === "OPTIONS") {
    if (!origenPermitido(origen)) return new Response("Origen no permitido", { status: 403, headers: cors(req) });
    return new Response("ok", { status: 200, headers: cors(req) });
  }
  if (req.method !== "POST") return json(req, 405, { ok: false, error: "Método no permitido." });
  if (!origenPermitido(origen)) return json(req, 403, { ok: false, error: "Origen no permitido." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const internalSecret = Deno.env.get("NOTIFICATION_INTERNAL_SECRET") || "";
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY") || "";
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) return json(req, 500, { ok: false, error: "Configuración del servidor incompleta." });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const secretReceived = req.headers.get("x-notification-secret") || "";
    let auth:
      | { mode: "internal"; userId: null; memberships: any[] }
      | { mode: "user"; userId: string; memberships: any[] };

    if (secretReceived) {
      if (!sameSecret(secretReceived, internalSecret)) {
        return json(req, 401, { ok: false, error: "Credencial interna no válida." });
      }
      auth = { mode: "internal", userId: null, memberships: [] };
    } else {
      const authorization = req.headers.get("Authorization") || "";
      const match = authorization.match(/^Bearer\s+(.+)$/i);
      if (!match) return json(req, 401, { ok: false, error: "Debes iniciar sesión." });

      const { data: userData, error: userError } = await admin.auth.getUser(match[1]);
      const userId = userData?.user?.id;
      if (userError || !userId) return json(req, 401, { ok: false, error: "La sesión no es válida o ha caducado." });

      const { data: profile, error: profileError } = await admin
        .from("perfiles")
        .select("user_id,activo")
        .eq("user_id", userId)
        .maybeSingle();
      if (profileError || profile?.activo !== true) {
        return json(req, 403, { ok: false, error: "El perfil no está activo." });
      }

      const { data: memberships, error: membershipError } = await admin
        .from("membresias_usuario")
        .select("user_id,empresa_id,local_id,todos_locales,rol,activo")
        .eq("user_id", userId)
        .eq("activo", true);
      if (membershipError || !memberships?.length) {
        return json(req, 403, { ok: false, error: "No existe una membresía activa." });
      }
      auth = { mode: "user", userId, memberships };
    }

    const body = await req.json().catch(() => ({}));
    const titulo = clean(body?.titulo, 80);
    const cuerpo = clean(body?.cuerpo, 400);
    const url = clean(body?.url, 200) || "/";
    let empresaId = clean(body?.empresaId, 120);
    const localId = clean(body?.localId, 120);

    if (!titulo || !cuerpo) return json(req, 400, { ok: false, error: "Falta título o cuerpo." });
    if (url !== "/") return json(req, 400, { ok: false, error: "Destino no permitido." });

    const permitidos = auth.mode === "internal" ? TITULOS_INTERNOS : TITULOS_CLIENTE;
    if (!permitidos.has(titulo)) return json(req, 403, { ok: false, error: "Tipo de notificación no permitido." });

    // Si hay local, su empresa es la autoridad. Un empresaId contradictorio falla cerrado.
    if (localId) {
      const { data: local, error: localError } = await admin
        .from("locales")
        .select("id,empresa_id,activo")
        .eq("id", localId)
        .maybeSingle();
      if (localError || !local || local.activo !== true) {
        return json(req, 400, { ok: false, error: "Local de notificación no válido." });
      }
      if (empresaId && empresaId !== local.empresa_id) {
        return json(req, 403, { ok: false, error: "El local no pertenece a la empresa indicada." });
      }
      empresaId = local.empresa_id;
    }

    if (!empresaId && auth.mode === "user") {
      const empresas = [...new Set(auth.memberships.map((m) => m.empresa_id).filter(Boolean))];
      if (empresas.length === 1) empresaId = String(empresas[0]);
    }
    if (!empresaId) {
      return json(req, 400, { ok: false, error: "No se puede determinar una empresa única para la notificación." });
    }
    if (TITULOS_CON_LOCAL.has(titulo) && !localId) {
      return json(req, 400, { ok: false, error: "Esta notificación requiere un local concreto." });
    }

    if (auth.mode === "user") {
      const roles = (titulo === "Caja descuadrada" || titulo === "Caja cerrada, ahora desactualizada")
        ? ROLES_CAJA
        : null;
      if (!userHasTenantScope({
        memberships: auth.memberships,
        userId: auth.userId,
        empresaId,
        localId,
        roles,
      })) {
        return json(req, 403, { ok: false, error: "No tienes alcance sobre la empresa/local de esta notificación." });
      }
    }

    if (!vapidPublic || !vapidPrivate) {
      return json(req, 500, { ok: false, error: "Notificaciones push no configuradas." });
    }

    const { data: subscriptions, error: subscriptionsError } = await admin
      .from("suscripciones_push")
      .select("endpoint,p256dh,auth,user_id");
    if (subscriptionsError) return json(req, 500, { ok: false, error: "No se pudo leer la lista de dispositivos." });

    const identified = (subscriptions || []).filter((s) => !!s.user_id);
    const userIds = [...new Set(identified.map((s) => s.user_id))];
    if (userIds.length === 0) {
      return json(req, 200, { ok: true, enviados: 0, caducados: 0, destinatarios: 0 });
    }

    const { data: profiles, error: profilesError } = await admin
      .from("perfiles")
      .select("user_id,activo")
      .in("user_id", userIds);
    if (profilesError) return json(req, 500, { ok: false, error: "No se pudieron comprobar los destinatarios." });

    const { data: recipientMemberships, error: recipientMembershipsError } = await admin
      .from("membresias_usuario")
      .select("user_id,empresa_id,local_id,todos_locales,rol,activo")
      .in("user_id", userIds)
      .eq("empresa_id", empresaId)
      .eq("activo", true);
    if (recipientMembershipsError) {
      return json(req, 500, { ok: false, error: "No se pudo comprobar el alcance de los destinatarios." });
    }

    const recipients = filterRecipientSubscriptions({
      subscriptions: identified,
      profiles: profiles || [],
      memberships: recipientMemberships || [],
      empresaId,
      localId,
      allowedRoles: ROLES_DESTINO[titulo] || ["Propietario"],
    });

    if (recipients.length === 0) {
      return json(req, 200, { ok: true, enviados: 0, caducados: 0, destinatarios: 0 });
    }

    webpush.setVapidDetails("mailto:admin@chocoloyos.local", vapidPublic, vapidPrivate);
    const payload = JSON.stringify({ titulo, cuerpo, url: "/" });
    let enviados = 0;
    const expired: string[] = [];

    await Promise.all(recipients.map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        enviados++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) expired.push(s.endpoint);
      }
    }));

    if (expired.length > 0) {
      await admin.from("suscripciones_push").delete().in("endpoint", expired);
    }

    return json(req, 200, {
      ok: true,
      empresaId,
      localId: localId || null,
      enviados,
      caducados: expired.length,
      destinatarios: recipients.length,
    });
  } catch {
    return json(req, 500, { ok: false, error: "Error inesperado enviando la notificación." });
  }
});
