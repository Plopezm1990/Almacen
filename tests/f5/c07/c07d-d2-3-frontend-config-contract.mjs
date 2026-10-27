import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const runtime = fs.readFileSync(path.join(root, "fuente.js"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261027163000_abc_f7_c07d_d2_3_frontend_config_status.sql"), "utf8");

function check(name, condition) {
  if (!condition) throw new Error(`C07D_D2_3_FRONTEND_FAIL=${name}`);
  console.log(`C07D_D2_3_FRONTEND_PASS=${name}`);
}

check("SERVER_CONFIG_STATUS_RPC", runtime.includes('supabase.rpc("abc_c07d_estado_configuracion_emision"'));
check("CONFIG_STATUS_REQUIRES_VALIDADA_OR_ACTIVA", runtime.includes('["VALIDADA", "ACTIVA"].includes(estadoConfiguracion)'));
check("VISUAL_EMISSION_BLOCK", runtime.includes('data-c07d-config-status": "blocked"'));
check("VISUAL_CONFIG_READY", runtime.includes('data-c07d-config-status": "ready"'));
check("EMITTER_PREFLIGHTS_CONFIG", runtime.includes('const configuracion = await leerConfiguracionEmisionC07D(tipoDocumento)'));
check("SERVER_OWNS_SERIES", runtime.includes("p_codigo_serie: null"));
check("CLIENT_SERIES_STRIPPED_FROM_PAYMENT", runtime.includes("delete opcionesServidor.codigoSerie"));
check("NO_DIRECT_CONFIG_DML_FRONTEND", !/\.from\(["']abc_c07d_emision_config["']\)\.(insert|update|upsert|delete)/.test(runtime));
check("NO_CREDENTIAL_OUTPUT", !runtime.includes("credential_ref"));
check("MIGRATION_STATUS_FUNCTION", migration.includes("abc_c07d_estado_configuracion_emision"));
check("MIGRATION_AUTHENTICATED_ONLY", migration.includes("grant execute on function public.abc_c07d_estado_configuracion_emision(text, text, text) to authenticated"));
check("MIGRATION_NO_AEAT_TRANSPORT", !migration.match(/https?:\/\/|agenciatributaria|tike-cont|private_key|client_secret/i));
check("MIGRATION_CREDENTIALS_REDUCED_TO_BOOLEAN", migration.includes("credential_configured") && migration.includes("credential_ref is not null"));

console.log("C07D_D2_3_FRONTEND_CONTRACT=PASS");
