import fs from "node:fs";
import assert from "node:assert/strict";

const sql = fs.readFileSync("supabase/migrations/20261017140000_pm13_p08_cargos_estado.sql", "utf8");
const ui = fs.readFileSync("fuente.js", "utf8");

assert.match(sql, /create or replace function public\.abc_desactivar_cargo\(/);
assert.match(sql, /create or replace function public\.abc_reactivar_cargo\(/);
assert.match(sql, /abc_config_puede_configurar_empresa/);
assert.match(sql, /select count\(\*\) into v_asignados/);
assert.match(sql, /cargo_tiene_asignaciones/);
assert.match(sql, /CARGO_DESACTIVADO/);
assert.match(sql, /CARGO_REACTIVADO/);
assert.doesNotMatch(sql, /delete from public\.abc_cargos/);
assert.match(ui, /abc_desactivar_cargo/);
assert.match(ui, /abc_reactivar_cargo/);
assert.match(ui, /cargo\.activo && Number\(cargo\.asignados_count/);

console.log("PM13 P11 Estado de cargos: contrato de bloqueo e historial OK");
