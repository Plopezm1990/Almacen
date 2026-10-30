import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261027143000_abc_f7_c07d_checkout_emit_qa.sql"), "utf8");
const runtime = fs.readFileSync(path.join(root, "fuente.js"), "utf8");
const recovered = fs.readFileSync(path.join(root, "source-recovery/fuente-recuperado.js"), "utf8");

function check(name, condition) {
  if (!condition) throw new Error(`C07D_CHECKOUT_EMIT_FAIL=${name}`);
  console.log(`C07D_CHECKOUT_EMIT_PASS=${name}`);
}

for (const source of [runtime, recovered]) {
  check("FRONTEND_EMIT_RPC", source.includes('supabase.rpc("abc_c07d_emitir_checkout"'));
  check("FRONTEND_STATE_RPC", source.includes('supabase.rpc("abc_c07d_estado_cuenta"'));
  check("FRONTEND_QA_STATUS", source.includes('data-c07d-qa-status'));
  check("FRONTEND_QA_ENVIRONMENT_GATE", source.includes("c07dActivoEnEntornoQa") && source.includes("window.__modoPruebasQA === true"));
  check("FRONTEND_PRODUCTION_GATE_UI", source.includes('data-c07d-production-gate') && source.includes("todavía no está activa en producción"));
  check("FRONTEND_NO_AEAT_TRANSPORT", source.includes('aeat_transport') === false || source.includes("DISABLED"));
}

for (const marker of [
  "abc_c07d_emitir_checkout",
  "abc_c07d_estado_cuenta",
  "abc_reservar_numero_documental",
  "abc_resolver_emision_documental",
  "abc_c07d_registrar_documento_fiscal",
  "qa_only",
  "DISABLED",
  "c07d_checkout_no_completado",
  "grant execute on function public.abc_c07d_emitir_checkout"
]) check(`MIGRATION_${marker}`, migration.includes(marker));

check("NO_AEAT_URL", !migration.match(/https?:\/\/|agenciatributaria|tike-cont|private_key|client_secret/i));
check("NO_DIRECT_C07D_DML_FRONTEND", !/\.from\(["']abc_c07d_(registros_fiscales|cola_fiscal)["']\)\.(insert|update|upsert|delete)/.test(runtime));
console.log("C07D_CHECKOUT_EMIT_CONTRACT=PASS");
