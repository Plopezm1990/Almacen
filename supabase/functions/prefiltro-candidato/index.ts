import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.27.3";

const SITE_HOST = "chic-entremet-9107cf.netlify.app";
const RATE_LIMIT_MAX = 20;

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
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json", ...extraHeaders },
  });
}

const SYSTEM_PROMPT_RESUMEN = `Eres un asistente de apoyo documental para un proceso de selección de personal en hostelería.
Resume únicamente la información aportada por el candidato. No puntúes, clasifiques, ordenes ni compares.
No decidas si es apto ni recomiendes contratar o descartar. No infieras características personales.
Devuelve SOLO JSON con esta forma:
{"resumen":"texto","experiencia":"texto","disponibilidad":"texto","motivacion":"texto","evidencias_aportadas":["texto"],"cuestiones_a_aclarar":["texto"]}`;

Deno.serve(async (req: Request) => {
  const origen = req.headers.get("Origin") || "";
  if (origen && !origenPermitido(origen)) return json(req, { ok: false, error: "Origen no permitido." }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: cors(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "Método no permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
  const notificationSecret = Deno.env.get("NOTIFICATION_INTERNAL_SECRET") || "";
  if (!supabaseUrl || !serviceRoleKey) return json(req, { ok: false, error: "Configuración del servidor incompleta." }, 500);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  async function fingerprint() {
    const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const network = req.headers.get("cf-connecting-ip")?.trim() || forwardedFor || req.headers.get("x-real-ip")?.trim();
    const fallback = (req.headers.get("origin") || "sin-origen") + "|" +
      (req.headers.get("user-agent")?.slice(0, 160) || "sin-ua");
    const material = network
      ? `prefiltro-candidato:red:${network.slice(0, 128)}`
      : `prefiltro-candidato:fallback:${fallback}`;
    const hmacKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(serviceRoleKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", hmacKey, new TextEncoder().encode(material));
    return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  try {
    const clave = await fingerprint();
    const { data: intentos, error: rateError } = await supabase.rpc("registrar_intento_prefiltro", { p_clave: clave });
    if (rateError || typeof intentos !== "number") throw new Error("rate_limit_unavailable");
    if (intentos > RATE_LIMIT_MAX) {
      return json(req, { ok: false, error: "Demasiados intentos. Espera un minuto y vuelve a intentarlo." }, 429, { "Retry-After": "60" });
    }

    const body = await req.json().catch(() => ({}));
    const accion = typeof body?.accion === "string" ? body.accion : "";
    const token = typeof body?.token === "string" ? body.token : "";
    const respuestas = body?.respuestas;

    if (!/^[a-f0-9]{64}$/i.test(token)) return json(req, { ok: false, error: "Token no válido." }, 400);

    const { data: fila, error: readError } = await supabase
      .from("prefiltros_candidatos")
      .select("estado,candidato_nombre,expira_en,empresa_id,local_id")
      .eq("token", token)
      .maybeSingle();

    if (readError || !fila) return json(req, { ok: false, error: "Enlace no válido." }, 404);
    if (!fila.empresa_id || !fila.local_id) return json(req, { ok: false, error: "El enlace no tiene contexto empresarial válido." }, 409);
    if (new Date(fila.expira_en).getTime() <= Date.now()) return json(req, { ok: false, error: "Este enlace ha caducado." }, 410);

    if (accion === "comprobar") {
      return json(req, { ok: true, estado: fila.estado, candidatoNombre: fila.candidato_nombre });
    }

    if (accion !== "enviar") return json(req, { ok: false, error: "Acción no reconocida." }, 400);
    if (fila.estado === "completado") return json(req, { ok: false, error: "Este cuestionario ya se envió antes." }, 409);
    if (!respuestas || typeof respuestas !== "object" || Array.isArray(respuestas)) {
      return json(req, { ok: false, error: "Faltan las respuestas." }, 400);
    }
    if (JSON.stringify(respuestas).length > 50000) {
      return json(req, { ok: false, error: "Las respuestas superan el tamaño permitido." }, 413);
    }

    let resumenIA = {
      resumen: "(No se pudo generar el resumen automático — revisa las respuestas directamente.)",
      experiencia: "",
      disponibilidad: "",
      motivacion: "",
      evidencias_aportadas: [] as string[],
      cuestiones_a_aclarar: [] as string[],
    };

    if (anthropicKey) {
      try {
        const anthropic = new Anthropic({ apiKey: anthropicKey });
        const resp = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 800,
          system: SYSTEM_PROMPT_RESUMEN,
          messages: [{ role: "user", content: JSON.stringify(respuestas) }],
        });
        const texto = resp.content.find((b: any) => b.type === "text")?.text || "";
        resumenIA = JSON.parse(texto.replace(/^\`\`\`json\s*/i, "").replace(/\`\`\`\s*$/i, "").trim());
      } catch {
        // El fallo de IA no impide guardar las respuestas del candidato.
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from("prefiltros_candidatos")
      .update({
        estado: "completado",
        respuestas,
        resumen: resumenIA,
        completado_en: new Date().toISOString(),
      })
      .eq("token", token)
      .eq("estado", "pendiente")
      .select("token")
      .maybeSingle();

    if (updateError) return json(req, { ok: false, error: "No se ha podido guardar." }, 500);
    if (!updated) return json(req, { ok: false, error: "Este cuestionario ya se procesó en otra sesión." }, 409);

    // La notificación interna conserva el tenant real de la fila del token.
    if (notificationSecret) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/enviar-notificacion`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-notification-secret": notificationSecret,
          },
          body: JSON.stringify({
            titulo: "Prefiltro completado",
            cuerpo: `${fila.candidato_nombre} ha completado el cuestionario.`,
            url: "/",
            empresaId: fila.empresa_id,
            localId: fila.local_id,
          }),
        });
      } catch {
        // El aviso es secundario: el cuestionario ya quedó guardado.
      }
    }

    return json(req, { ok: true });
  } catch {
    return json(req, { ok: false, error: "Error del servidor." }, 500);
  }
});
