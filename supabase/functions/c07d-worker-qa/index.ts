import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE_HOST = "chic-entremet-9107cf.netlify.app";
const CLAIM_OPERATION_PREFIX = "qa.worker.c07d.claim";

function origenPermitido(origen: string) {
  if (!origen) return true;
  try {
    const url = new URL(origen);
    return url.protocol === "https:" &&
      (url.hostname === SITE_HOST || url.hostname.endsWith("--" + SITE_HOST));
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
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json" },
  });
}

function texto(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function limite(value: unknown) {
  const number = Number(value ?? 10);
  return Number.isInteger(number) && number >= 1 && number <= 50 ? number : null;
}

function errorPublico(error: unknown) {
  const message = error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message || "")
    : String(error || "");
  return message || "No se pudo procesar la cola fiscal QA.";
}

Deno.serve(async (req: Request) => {
  const origen = req.headers.get("Origin") || "";
  if (req.method === "OPTIONS") {
    if (!origenPermitido(origen)) return new Response("Origen no permitido", { status: 403, headers: cors(req) });
    return new Response("ok", { status: 200, headers: cors(req) });
  }
  if (req.method !== "POST") return json(req, { ok: false, qa: true, error: "Método no permitido." }, 405);
  if (!origenPermitido(origen)) return json(req, { ok: false, qa: true, error: "Origen no permitido." }, 403);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!supabaseUrl || !anonKey) return json(req, { ok: false, qa: true, error: "Configuración del servidor incompleta." }, 500);

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
    const empresaId = texto(body?.empresaId, 160);
    const localId = texto(body?.localId, 160);
    const maxItems = limite(body?.limite);
    const modo = texto(body?.modo, 40).toUpperCase();
    if (!empresaId || !localId || !maxItems || modo !== "QA_SIMULADOR") {
      return json(req, {
        ok: false,
        qa: true,
        error: "El worker QA requiere empresaId, localId, limite válido y modo QA_SIMULADOR.",
      }, 400);
    }

    const claimOperationId = `${CLAIM_OPERATION_PREFIX}.${crypto.randomUUID()}`;
    const { data: reclamacion, error: claimError } = await caller.rpc("abc_c07d_reclamar_cola_fiscal", {
      p_operation_id: claimOperationId,
      p_empresa_id: empresaId,
      p_local_id: localId,
      p_limite: maxItems,
    });
    if (claimError) return json(req, { ok: false, qa: true, error: errorPublico(claimError) }, 502);

    const items = Array.isArray(reclamacion?.items) ? reclamacion.items : [];
    const resultados: unknown[] = [];
    for (const item of items) {
      const colaId = texto(item?.id, 80);
      if (!colaId) continue;
      const { data: resuelto, error: resolveError } = await caller.rpc("abc_c07d_resolver_cola_fiscal", {
        p_operation_id: claimOperationId,
        p_empresa_id: empresaId,
        p_local_id: localId,
        p_cola_id: colaId,
        p_estado: "ACEPTADO",
        p_resultado: {
          modo: "QA_SIMULADOR",
          aeat_real: false,
          resultado: "ACEPTADO",
          worker: "c07d-worker-qa",
          usuario_id: sessionUser.user.id,
          procesado_at: new Date().toISOString(),
        },
      });
      resultados.push(resolveError ? { cola_id: colaId, ok: false, error: errorPublico(resolveError) } : resuelto);
    }

    const fallidos = resultados.filter((resultado) => resultado && typeof resultado === "object" && (resultado as { ok?: boolean }).ok === false).length;
    return json(req, {
      ok: fallidos === 0,
      qa: true,
      modo: "QA_SIMULADOR",
      aeat_real: false,
      reclamadas: items.length,
      resueltas: resultados.length - fallidos,
      fallidas: fallidos,
      resultados,
    }, fallidos === 0 ? 200 : 502);
  } catch (error) {
    return json(req, { ok: false, qa: true, error: errorPublico(error) }, 500);
  }
});
