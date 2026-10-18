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

// PM13 P06: excepciones individuales. La migración p06 redefine el resolver con la
// excepción por encima del cargo, conservando las barreras de seguridad, y añade la
// tabla y la RPC de configuración (solo propietario, deny por defecto).
const p06 = fs.readFileSync(path.join(root, "supabase/migrations/20261018120000_pm13_p06_excepciones_permiso.sql"), "utf8");
assert.match(p06, /create table if not exists public\.abc_permiso_excepciones/);
assert.match(p06, /alter table public\.abc_permiso_excepciones enable row level security/);
assert.match(p06, /revoke all on table public\.abc_permiso_excepciones from anon, authenticated/);
assert.match(p06, /create or replace function public\.pm13_configurar_excepcion_permiso/);
assert.match(p06, /m\.rol = 'Propietario'/);
assert.match(p06, /efecto_no_valido/);
assert.match(p06, /create or replace function public\.pm13_resolver_cargo_permiso/);
assert.ok(p06.indexOf("techo_rol_tecnico") >= 0 && p06.indexOf("techo_rol_tecnico") < p06.indexOf("excepcion_denegada"), "las barreras de seguridad preceden a la excepción");
assert.ok(p06.indexOf("excepcion_denegada") >= 0 && p06.indexOf("excepcion_denegada") < p06.indexOf("cargo_revocado"), "la excepción manda sobre el cargo");
assert.match(p06, /excepcion_concedida/);
assert.ok(p06.includes("'dependencia_consulta_faltante', 'fuente', 'excepcion'"), "un allow individual sigue sujeto a la dependencia de consulta");
assert.doesNotMatch(p06, /drop table/i);
assert.doesNotMatch(p06, /migration repair/i);
console.log("PM13 P06 Excepciones individuales: precedencia barreras>excepción>cargo, RPC propietario y deny por defecto OK");
