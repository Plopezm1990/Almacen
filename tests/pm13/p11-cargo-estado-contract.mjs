import fs from "node:fs";
import assert from "node:assert/strict";

const sql = fs.readFileSync("supabase/migrations/20261129120000_abc_f6_cargos_estado_eliminacion.sql", "utf8");
const ui = fs.readFileSync("fuente.js", "utf8");

assert.match(sql, /create or replace function public\.abc_desactivar_cargo\(/);
assert.match(sql, /create or replace function public\.abc_reactivar_cargo\(/);
assert.match(sql, /pm13_cargo_validar_contexto/);
assert.match(sql, /select count\(distinct a\.empleado_id\) into v_asignados/);
assert.match(sql, /personas_afectadas/);
assert.match(sql, /CARGO_DESACTIVADO/);
assert.match(sql, /CARGO_REACTIVADO/);
assert.match(sql, /create or replace function public\.abc_eliminar_cargo\(/);
assert.match(sql, /eliminado boolean not null default false/);
assert.match(sql, /CARGO_ELIMINADO/);
assert.doesNotMatch(sql, /delete from public\.abc_cargos/);
assert.match(ui, /abc_desactivar_cargo/);
assert.match(ui, /abc_reactivar_cargo/);
assert.match(ui, /abc_eliminar_cargo/);
assert.match(ui, /confirmacionCargo/);
assert.doesNotMatch(ui, /cargo\.activo && Number\(cargo\.asignados_count\(\|\| 0\) > 0/);

console.log("PM13 P11 Estado de cargos: desactivación reversible, eliminación lógica e historial OK");
