import fs from "node:fs";
import assert from "node:assert/strict";

const sql = fs.readFileSync("supabase/migrations/20261017150000_pm13_p08_proteccion_propietario.sql", "utf8");
const correction = fs.readFileSync("supabase/migrations/20261128150000_abc_f6_cargos_nombres_navegacion_excepciones.sql", "utf8");
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
assert.match(correction, /drop trigger if exists pm13_cargo_guard_nombre/);
assert.match(correction, /los cargos personalizados admiten cualquier nombre válido/i);
assert.doesNotMatch(correction, /new\.nombre_normalizado = any/);
assert.match(correction, /pm13_cargo_guard_propietario/);

console.log("PM13 P12 Protección de propietario: nombres libres, separación y no autoelevación OK");
