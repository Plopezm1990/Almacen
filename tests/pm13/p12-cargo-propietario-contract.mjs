import fs from "node:fs";
import assert from "node:assert/strict";

const sql = fs.readFileSync("supabase/migrations/20261017150000_pm13_p08_proteccion_propietario.sql", "utf8");
const ui = fs.readFileSync("fuente.js", "utf8");

assert.match(sql, /pm13_cargo_guard_nombre/);
assert.match(sql, /cargo_nombre_reservado/);
assert.match(sql, /propietario.*encargado.*cajero\/a.*camarero\/a/);
assert.match(sql, /pm13_cargo_guard_propietario/);
assert.match(sql, /p\.rol = 'Propietario'/);
assert.match(sql, /m\.rol = 'Propietario'/);
assert.match(sql, /cargo_propietario_no_asignable/);
assert.doesNotMatch(sql, /update public\.perfiles/);
assert.doesNotMatch(sql, /update public\.membresias_usuario/);
assert.match(ui, /cargo_nombre_reservado/);
assert.match(ui, /cargo_propietario_no_asignable/);

console.log("PM13 P12 Protección de propietario: contrato de separación y no autoelevación OK");
