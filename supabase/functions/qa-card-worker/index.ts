import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const QA_PROJECT_URL = "https://qjqorixtkilwsndqayyx.supabase.co";
const SITE_HOST = "chic-entremet-9107cf.netlify.app";

function originAllowed(origin: string) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return url.protocol === "https:" &&
      (url.hostname === SITE_HOST || url.hostname.endsWith("--" + SITE_HOST));
  } catch {
    return false;
  }
}

function cors(req: Request) {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": originAllowed(origin) ? origin : "",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json" },
  });
}

function text(value: unknown, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function publicError(error: unknown) {
  const message = error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message || "")
    : String(error || "");
  return message || "No se pudo resolver la tarjeta simulada QA.";
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  if (req.method === "OPTIONS") {
    if (!originAllowed(origin)) return new Response("Origen no permitido", { status: 403, headers: cors(req) });
    return new Response("ok", { status: 200, headers: cors(req) });
  }
  if (req.method !== "POST") return json(req, { ok: false, qa: true, error: "Método no permitido." }, 405);
  if (!originAllowed(origin)) return json(req, { ok: false, qa: true, error: "Origen no permitido." }, 403);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (supabaseUrl !== QA_PROJECT_URL || !anonKey || !serviceRoleKey) {
    return json(req, { ok: false, qa: true, error: "Worker de tarjeta QA no disponible en este entorno." }, 404);
  }

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json(req, { ok: false, qa: true, error: "Sesión no válida." }, 401);

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: sessionUser, error: sessionError } = await caller.auth.getUser();
    if (sessionError || !sessionUser?.user) return json(req, { ok: false, qa: true, error: "No se pudo verificar la sesión." }, 401);

    const body = await req.json().catch(() => ({}));
    const empresaId = text(body?.empresaId);
    const localId = text(body?.localId);
    const cuentaId = text(body?.cuentaId, 80);
    const intentoId = text(body?.intentoId, 80);
    const amount = Number(body?.importe);
    const mode = text(body?.modo, 40).toUpperCase();
    if (!empresaId || !localId || !cuentaId || !intentoId || !Number.isFinite(amount) || amount <= 0 || mode !== "QA_SIMULADOR") {
      return json(req, { ok: false, qa: true, error: "El worker QA requiere contexto, intento, importe positivo y modo QA_SIMULADOR." }, 400);
    }

    const { data: visibleState, error: stateError } = await caller.rpc("abc_estado_pago_mixto_cuenta", {
      p_empresa_id: empresaId,
      p_local_id: localId,
      p_cuenta_id: cuentaId,
    });
    if (stateError) return json(req, { ok: false, qa: true, error: publicError(stateError) }, 403);

    const attempt = Array.isArray(visibleState?.intentos)
      ? visibleState.intentos.find((item: Record<string, unknown>) => String(item?.id) === intentoId)
      : null;
    const payment = Array.isArray(visibleState?.pagos)
      ? visibleState.pagos.find((item: Record<string, unknown>) => String(item?.id) === String(attempt?.pago_id))
      : null;
    if (!attempt || !payment || String(payment.medio || "").toUpperCase() !== "TARJETA") {
      return json(req, { ok: false, qa: true, error: "El intento no pertenece a una tarjeta de esta cuenta QA." }, 409);
    }
    if (String(attempt.estado || "").toUpperCase() !== "PENDIENTE" || Math.abs(Number(attempt.requested_amount) - amount) > 0.000001) {
      return json(req, { ok: false, qa: true, error: "El intento ya no está pendiente o el importe no coincide." }, 409);
    }
    if (Math.abs(Number(visibleState?.saldo) - amount) > 0.000001) {
      return json(req, { ok: false, qa: true, error: "El saldo del servidor no coincide con el intento QA." }, 409);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const providerReference = `qa-sim-card-${intentoId}`;
    const operationId = `f4.qa.card.resolve.${intentoId}`;
    const { data: result, error: resolveError } = await admin.rpc("abc_resolver_intento", {
      p_operation_id: operationId,
      p_empresa_id: empresaId,
      p_local_id: localId,
      p_intento_id: intentoId,
      p_estado: "CONFIRMADO",
      p_provider_code: "SIMULATOR",
      p_provider_reference: providerReference,
      p_authorized_amount: amount,
      p_captured_amount: amount,
      p_settled_amount: amount,
      p_provider_snapshot: {
        modo: "QA_SIMULADOR",
        worker: "qa-card-worker",
        usuario_id: sessionUser.user.id,
        provider_event_id: operationId,
        provider_reference: providerReference,
      },
    });
    if (resolveError) return json(req, { ok: false, qa: true, error: publicError(resolveError) }, 502);
    return json(req, {
      ok: result?.ok !== false,
      qa: true,
      modo: "QA_SIMULADOR",
      estado: "CONFIRMADO",
      intentoId,
      providerCode: "SIMULATOR",
      providerReference,
      resultado: result,
    }, result?.ok === false ? 502 : 200);
  } catch (error) {
    return json(req, { ok: false, qa: true, error: publicError(error) }, 500);
  }
});
