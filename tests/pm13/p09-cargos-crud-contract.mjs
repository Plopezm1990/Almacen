import fs from "node:fs";
import assert from "node:assert/strict";

const sql = fs.readFileSync("supabase/migrations/20261017120000_pm13_p08_cargos_catalogo.sql", "utf8");
const ui = fs.readFileSync("fuente.js", "utf8");

assert.match(sql, /create table if not exists public\.abc_cargos/);
assert.match(sql, /empresa_id text not null references public\.empresas\(id\)/);
assert.match(sql, /nombre_normalizado text not null/);
assert.match(sql, /create unique index if not exists abc_cargos_empresa_nombre_uq/);
assert.match(sql, /revoke all on table public\.abc_cargos from public, anon, authenticated, service_role/);
assert.match(sql, /create or replace function public\.abc_listar_cargos\(p_empresa_id text, p_local_id text\)/);
assert.match(sql, /create or replace function public\.abc_crear_cargo\(/);
assert.match(sql, /create or replace function public\.abc_editar_cargo\(/);
assert.match(sql, /create or replace function public\.abc_duplicar_cargo\(/);
assert.match(sql, /private\.pm13_cargo_autorizado/);
assert.match(sql, /private\.pm13_cargo_auditar/);
assert.match(ui, /abc_listar_cargos/);
assert.match(ui, /abc_crear_cargo/);
assert.match(ui, /abc_editar_cargo/);
assert.match(ui, /abc_duplicar_cargo/);

console.log("PM13 P09 Cargos CRUD: contrato servidor y UI OK");
