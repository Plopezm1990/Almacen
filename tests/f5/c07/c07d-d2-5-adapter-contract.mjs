import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const doc = await readFile("docs/plan-maestro/C07_D2_5_CONTRATO_ADAPTADOR_SANDBOX_2026-10-27.md", "utf8");
const migration = await readFile("supabase/migrations/20261027150000_abc_f7_c07d_d2_emission_config.sql", "utf8");
const frontend = await readFile("fuente.js", "utf8");

const checks = [
  ["SCOPE_PER_COMPANY_EMITTER", doc.includes("empresa_id + local_id + entidad_fiscal_id + tipo_documento")],
  ["ADAPTER_INTERFACE", doc.includes("preparar_envio") && doc.includes("consultar_resultado")],
  ["NORMALIZED_OUTCOMES", doc.includes("ACCEPTED_WITH_ERRORS") && doc.includes("UNKNOWN") && doc.includes("RETRYABLE")],
  ["IDEMPOTENCY_RULES", doc.includes("idempotency_key") && doc.includes("payload diferente")],
  ["PRODUCTION_GATE", doc.includes("PRODUCTION_ENABLED") && doc.includes("segunda confirmación")],
  ["QA_SIMULATOR_DISABLED", doc.includes("SIMULADOR_C07D") && doc.includes("transporte `DISABLED`")],
  ["NO_ENDPOINT_OR_SECRET_CONFIG", migration.includes("endpoint") && migration.includes("private_key") && migration.includes("credential_ref")],
  ["FRONTEND_NO_REAL_TRANSPORT", frontend.includes("aeat_transport") === false || frontend.includes("DISABLED")],
  ["NO_PRODUCTION_SCOPE_FOR_SIMULATOR", doc.includes("entornos `QA` y `SANDBOX` declarados, nunca `PRODUCCION`")]
];

for (const [name, ok] of checks) {
  assert.ok(ok, `falló ${name}`);
  console.log(`C07D_D2_5_PASS=${name}`);
}

console.log("C07D_D2_5_ADAPTER_CONTRACT=PASS");
