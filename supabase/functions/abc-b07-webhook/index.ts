import { createClient } from "npm:@supabase/supabase-js@2";
import {
  constantTimeEqualText,
  encodeSignature,
  normalizeProviderEvent,
  signatureHeaderName,
} from "../_shared/abc-b07-adapter.mjs";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8" },
});

const configValue = (config: Record<string, unknown>, key: string) => {
  const value = config[key];
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
};

async function verifyHmac(rawBody: string, signature: string, signatureConfig: Record<string, unknown>, secret: string) {
  const algorithm = signatureConfig.algorithm;
  if (algorithm !== "HMAC_SHA256" && algorithm !== "HMAC_SHA512") return false;
  const hash = algorithm === "HMAC_SHA512" ? "SHA-512" : "SHA-256";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return constantTimeEqualText(
    encodeSignature(new Uint8Array(digest), String(signatureConfig.encoding || "HEX")),
    signature.trim(),
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: "server_not_configured" }, 500);

  const providerCode = req.headers.get("x-abc-b07-provider-code")?.trim().toUpperCase();
  const providerAccountId = req.headers.get("x-abc-b07-account-id")?.trim();
  if (!providerCode || !providerAccountId) return json({ ok: false, error: "provider_account_required" }, 400);

  const rawBody = await req.text();
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: configuration, error: configurationError } = await admin.rpc(
    "abc_b07_obtener_configuracion",
    { p_provider_code: providerCode, p_provider_account_id: providerAccountId },
  );
  if (configurationError || !configuration || Object.keys(configuration).length === 0) {
    return json({ ok: false, error: "provider_configuration_not_found" }, 404);
  }

  const signatureConfig = configValue(configuration, "signature_config");
  const normalizationConfig = configValue(configuration, "normalization_config");
  const isSimulation = req.headers.get("x-abc-b07-simulated") === "true";
  if (isSimulation) {
    const simulationSecret = Deno.env.get("ABC_B07_SIMULATION_SECRET");
    const suppliedSecret = req.headers.get("x-abc-b07-simulation-secret");
    if (!simulationSecret || !suppliedSecret || !constantTimeEqualText(simulationSecret, suppliedSecret)) {
      return json({ ok: false, error: "simulation_not_authorized" }, 401);
    }
  } else {
    if (signatureConfig.algorithm === "ASYMMETRIC") {
      return json({ ok: false, error: "asymmetric_adapter_pending" }, 501);
    }
    const signature = signatureConfig.location === "QUERY"
      ? new URL(req.url).searchParams.get(signatureHeaderName(signatureConfig))
      : req.headers.get(signatureHeaderName(signatureConfig));
    const secretRef = typeof configuration.secret_ref === "string" ? configuration.secret_ref : "";
    const secret = secretRef ? Deno.env.get(secretRef) : undefined;
    if (!signature || !secret || !(await verifyHmac(rawBody, signature, signatureConfig, secret))) {
      return json({ ok: false, error: "invalid_signature" }, 401);
    }
  }

  try {
    const event = normalizeProviderEvent({
      providerCode,
      providerAccountId: configuration.provider_account_id,
      payload,
      normalizationConfig,
    });
    return json({ ok: true, mode: isSimulation ? "simulation" : "provider", effect_applied: false, event });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "invalid_provider_event" }, 400);
  }
});
