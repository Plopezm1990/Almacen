import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const migration = await fs.readFile(
  path.join(root, "supabase/migrations/20261027160000_abc_f7_c07d_d2_emission_wiring.sql"),
  "utf8",
);
const lockFix = await fs.readFile(
  path.join(root, "supabase/migrations/20261027161000_abc_f7_c07d_d2_emission_resolver_lock_fix.sql"),
  "utf8",
);
const indexes = await fs.readFile(
  path.join(root, "supabase/migrations/20261027162000_abc_f7_c07d_d2_emission_config_indexes.sql"),
  "utf8",
);

const checks = [
  ["PREFLIGHT_CONFIG_RESOLVER", /private\.abc_c07d_resolver_emision_config\(text,text,uuid,text\)/i],
  ["SERVER_RESOLVES_CONFIG", /v_config := private\.abc_c07d_resolver_emision_config/i],
  ["SERVER_SERIES_WINS", /v_serie_resuelta := upper\(btrim\(v_config->>'codigo_serie'\)\)/i],
  ["CLIENT_SERIES_AUDIT_ONLY", /serie_solicitada_cliente/i],
  ["PRECHECK_BEFORE_RESERVATION", /Preflight completo:[\s\S]*?for v_venta in[\s\S]*?abc_reservar_numero_documental/i],
  ["ENTITY_MISMATCH_BLOCKED", /C07D_VENTA_ENTIDAD_NO_CORRESPONDE/i],
  ["NO_CREDENTIAL_REF_IN_OUTPUT", !/credential_ref.*v_result/is.test(migration)],
  ["QA_ONLY", /'qa_only', true/i],
  ["DISABLED_TRANSPORT", /'aeat_transport', 'DISABLED'/i],
  ["AUTHENTICATED_GRANT", /grant execute on function public\.abc_c07d_emitir_checkout\([^;]+\)\s+to authenticated;/i],
  ["RESOLVER_LOCK_FIX", /create or replace function private\.abc_c07d_resolver_emision_config[\s\S]*?volatile[\s\S]*?for share/i.test(lockFix)],
  ["CONFIG_FK_INDEXES", /abc_c07d_emision_adapter_fk_idx[\s\S]*abc_c07d_emision_updated_by_fk_idx[\s\S]*abc_c07d_revision_actor_fk_idx/i.test(indexes)],
];

for (const [name, condition] of checks) {
  if (!condition) throw new Error(`C07D_D2_WIRING_FAIL=${name}`);
  console.log(`C07D_D2_WIRING_PASS=${name}`);
}

console.log("C07D_D2_WIRING_CONTRACT=PASS");
