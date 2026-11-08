import fs from "node:fs";
import assert from "node:assert/strict";

const sql = fs.readFileSync(
  "supabase/migrations/20261017160000_pm13_p04_cargo_pantallas.sql",
  "utf8",
);
const ui = fs.readFileSync("fuente.js", "utf8");
const recovered = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");

assert.match(sql, /create table if not exists public\.abc_cargo_pantallas/);
assert.match(sql, /empresa_id text not null references public\.empresas\(id\) on delete restrict/);
assert.match(sql, /cargo_id uuid not null references public\.abc_cargos\(id\) on delete restrict/);
assert.match(sql, /capacidad_consulta text not null/);
assert.match(sql, /create unique index if not exists abc_cargo_pantallas_empresa_cargo_capacidad_uq/);
assert.match(sql, /alter table public\.abc_cargo_pantallas enable row level security/);
assert.match(sql, /revoke all on table public\.abc_cargo_pantallas from public, anon, authenticated, service_role/);
assert.equal(new Set(sql.match(/ABC_PANTALLA_[A-Z0-9_]+_CONSULTAR/g) || []).size, 45);

assert.match(sql, /create or replace function public\.abc_listar_cargo_pantallas\(/);
assert.match(sql, /create or replace function public\.abc_guardar_cargo_pantallas\(/);
assert.match(sql, /private\.pm13_cargo_validar_contexto\(p_empresa_id, p_local_id\)/g);
assert.match(sql, /not exists \(\s*select 1\s+from private\.pm13_p04_catalogo_consulta/s);
assert.match(sql, /delete from public\.abc_cargo_pantallas/);
assert.match(sql, /insert into public\.abc_cargo_pantallas/);
assert.match(sql, /'CARGO_PANTALLAS_GUARDADAS'/);
assert.match(sql, /'antes', v_antes/);
assert.match(sql, /'despues', v_despues/);
assert.match(sql, /'momento', clock_timestamp\(\)/);
assert.match(sql, /grant execute on function public\.abc_guardar_cargo_pantallas\([^\n]+\) to authenticated/);
assert.match(sql, /'pantallas_consulta', coalesce/);

for (const [file, source] of [["fuente.js", ui], ["source-recovery/fuente-recuperado.js", recovered]]) {
  assert.match(source, /abc_guardar_cargo_pantallas/);
  assert.match(source, /p_capacidades: capacidades/);
  assert.match(source, /pantallas_consulta/);
  assert.match(source, /Guardar selección/);
}

console.log("PM13 P17 Persistencia de pantallas por cargo: contrato SQL, autorización, auditoría y UI OK");
