import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261017193000_pm13_p05_cargo_action_resolver.sql"), "utf8");
const doc = fs.readFileSync(path.join(root, "docs/plan-empresas/PM13_P05_05_PERSISTENCIA_PERMISOS_2026-10-17.md"), "utf8");

assert.match(migration, /create table if not exists public\.abc_cargo_permisos/);
assert.match(migration, /private\.pm13_p05_acciones_catalogo/);
assert.match(migration, /PM13_PERSONAL_CONSULTAR/);
assert.match(migration, /PM13_FICHAJE_CORREGIR/);
assert.match(migration, /PM13_AUSENCIA_ANULAR/);
assert.match(migration, /create or replace function public\.pm13_configurar_cargo_permiso/);
assert.match(migration, /create or replace function public\.pm13_resolver_cargo_permiso/);
assert.match(migration, /private\.pm13_p05_rol_alcanza/);
assert.match(migration, /private\.pm13_p05_alcance_cubre/);
assert.match(migration, /v_member\.rol = 'Propietario'/);
assert.match(migration, /cp\.permitido = false/);
assert.match(migration, /cargo_revocado/);
assert.match(migration, /dependencia_consulta_faltante/);
assert.match(migration, /alter table public\.abc_cargo_permisos enable row level security/);
assert.match(migration, /revoke all on table public\.abc_cargo_permisos from public, anon, authenticated, service_role/);
assert.match(migration, /operationId/);
assert.doesNotMatch(migration, /drop table/i);
assert.doesNotMatch(migration, /migration repair/i);
assert.match(doc, /denegar por defecto/i);
assert.match(doc, /operation_id/);
assert.match(doc, /revocar/i);

console.log("PM13 P18 Resolver de acciones de cargo: catálogo, techo, alcance, dependencia y revocación OK");
