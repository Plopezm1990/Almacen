import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../");
const read = (file) => fs.readFile(path.join(root, file), "utf8");
const migration = await read("supabase/migrations/20261027150000_abc_f7_c07d_d2_emission_config.sql");
const repair = await read("supabase/migrations/20261027151000_abc_f7_c07d_d2_emission_config_fix.sql");
const scopeFix = await read("supabase/migrations/20261027152000_abc_f7_c07d_d2_adapter_scope_fix.sql");

const checks = [
  ["TABLE_adapters", /create table private\.abc_c07d_adaptadores_fiscales/i.test(migration)],
  ["TABLE_emission_config", /create table private\.abc_c07d_emision_config/i.test(migration)],
  ["TABLE_immutable_revisions", /create table private\.abc_c07d_emision_config_revisiones/i.test(migration)],
  ["RLS_all_private_tables", /alter table private\.abc_c07d_adaptadores_fiscales enable row level security[\s\S]*alter table private\.abc_c07d_emision_config enable row level security[\s\S]*alter table private\.abc_c07d_emision_config_revisiones enable row level security/i.test(migration)],
  ["NO_direct_table_grants", !/grant\s+(?:select|insert|update|delete|all)\s+on\s+table\s+private\.abc_c07d_/i.test(migration)],
  ["SIMULATOR_seed", /SIMULADOR_C07D[\s\S]*DISABLED/i.test(migration)],
  ["SERIES_scope_validation", /C07D_CONFIG_SERIE_NO_CORRESPONDE/i.test(migration)],
  ["NO_secret_values", /C07D_CONFIG_NO_ADMITE_SECRETOS/i.test(migration)],
  ["NO_production_activation", /if v_estado = 'ACTIVA' then[\s\S]*C07D_ACTIVACION_REQUIERE_REVISION/i.test(migration)],
  ["VERSION_guard", /C07D_CONFIG_VERSION_OBSOLETA/i.test(migration)],
  ["IMMUTABLE_history", /C07D_CONFIG_HISTORIAL_INMUTABLE/i.test(migration)],
  ["RPC_list_adapters", /create function public\.abc_c07d_listar_adaptadores_fiscales\(\s*p_empresa_id text,\s*p_local_id text\s*\)/i.test(migration)],
  ["RPC_read_config", /create function public\.abc_c07d_leer_emision_config\(/i.test(migration)],
  ["RPC_save_config", /create function public\.abc_c07d_guardar_emision_config\(/i.test(migration)],
  ["RPC_authenticated_grants", /grant execute on function public\.abc_c07d_guardar_emision_config\([^;]+\) to authenticated;/i.test(migration)],
  ["INSERT_trigger_repaired", /if tg_op = 'UPDATE'[\s\S]*C07D_CONFIG_SCOPE_INMUTABLE/i.test(repair)],
  ["ADAPTER_scope_not_entity_assumption", /not exists \(\s*select 1 from public\.membresias_usuario/i.test(scopeFix)],
  ["NO_AEAT_or_url_literal", !/https?:\/\/|agenciatributaria/i.test(migration)],
];

for (const [name, ok] of checks) {
  assert.ok(ok, `C07-D.2.1: ${name}`);
  console.log(`C07D_D2_CONFIG_PASS=${name}`);
}

console.log("C07D_D2_CONFIG_CONTRACT=PASS");
