import fs from "node:fs";
import assert from "node:assert/strict";

const sql = fs.readFileSync("supabase/migrations/20261017130000_pm13_p08_cargo_asignaciones.sql", "utf8");
const ui = fs.readFileSync("fuente.js", "utf8");

assert.match(sql, /create table if not exists public\.abc_cargo_asignaciones/);
assert.match(sql, /empleado_id text not null references public\.empleados\(id\)/);
assert.match(sql, /cargo_id uuid not null references public\.abc_cargos\(id\)/);
assert.match(sql, /create unique index if not exists abc_cargo_asig_activa_uq/);
assert.match(sql, /where activo = true/);
assert.match(sql, /e\.empresa_id = p_empresa_id/);
assert.match(sql, /e\.local_id = p_local_id/);
assert.match(sql, /e\.estado = 'activo'/);
assert.match(sql, /create or replace function public\.abc_asignar_cargo\(/);
assert.match(sql, /create or replace function public\.abc_desasignar_cargo\(/);
assert.match(sql, /revoke all on table public\.abc_cargo_asignaciones from public, anon, authenticated, service_role/);
assert.match(ui, /Asignar a este local/);
assert.match(ui, /Cargo asignado al empleado/);
assert.match(ui, /Cargo retirado del empleado/);

console.log("PM13 P10 Asignaciones de cargos: contrato servidor y UI OK");
