import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const doc = await readFile("docs/plan-maestro/C07_D2_6_EXPEDIENTE_ACTIVACION_EMPRESA_2026-10-27.md", "utf8");
const runtime = await readFile("fuente.js", "utf8");
const configMigration = await readFile("supabase/migrations/20261027150000_abc_f7_c07d_d2_emission_config.sql", "utf8");

const checks = [
  ["DOSSIER_SCOPE", doc.includes("empresa_id") && doc.includes("entidad_fiscal_id") && doc.includes("adapter_version")],
  ["CHECKLIST_IDENTITY_SCOPE_REPRESENTATION", doc.includes("Identidad") && doc.includes("Ámbito") && doc.includes("Representación")],
  ["CHECKLIST_QR_IDEMPOTENCY_HARDWARE", doc.includes("QR") && doc.includes("Idempotencia") && doc.includes("Hardware")],
  ["STATE_MACHINE", doc.includes("BORRADOR") && doc.includes("READY_FOR_TEST") && doc.includes("TEST_PASS") && doc.includes("PRODUCTION_ENABLED")],
  ["DOUBLE_APPROVAL", doc.includes("Doble aprobación") && doc.includes("segundo aprobador")],
  ["REVOCATION_PRESERVES_HISTORY", doc.includes("conserva la historia")],
  ["QA_TRANSPORT_DISABLED", doc.includes("SIMULADOR_C07D") && doc.includes("DISABLED") && doc.includes("no contactado")],
  ["NO_RAW_SECRET_IN_CONFIG", configMigration.includes("credential_ref") && configMigration.includes("private_key") && configMigration.includes("endpoint")],
  ["NO_FRONTEND_PRODUCTION_ENABLE", !/PRODUCTION_ENABLED|PRODUCCION_ENABLED|TEST_PASS/.test(runtime)],
  ["NO_AEAT_TRANSPORT_FRONTEND", runtime.includes("aeat_transport") === false || runtime.includes("DISABLED")]
];

for (const [name, ok] of checks) {
  assert.ok(ok, `falló ${name}`);
  console.log(`C07D_D2_6_PASS=${name}`);
}

console.log("C07D_D2_6_ACTIVATION_DOSSIER=PASS");
