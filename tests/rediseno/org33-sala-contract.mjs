import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const source = await readFile(new URL("../../fuente.js", import.meta.url), "utf8");

assert.match(source, /function ConfigSala\(/);
assert.match(source, /\["sala", "Sala y mesas"\]/);
assert.match(source, /cargarMapaSala: cargarMapaSalaA07/);
assert.match(source, /configRpc\("abc_crear_zona"/);
assert.match(source, /configRpc\("abc_actualizar_zona"/);
assert.match(source, /configRpc\("abc_crear_mesa"/);
assert.match(source, /configRpc\("abc_actualizar_mesa"/);
assert.match(source, /catalogo_tpv_tarifas_horario/);
assert.match(source, /catalogo_tpv_tarifa_precios/);
assert.match(source, /configRpc\("abc_guardar_tarifa_horario"/);
assert.match(source, /configRpc\("abc_guardar_tarifa_precio"/);
assert.match(source, /Tarifas horarias/);
assert.match(source, /no expone el contrato de tarifas horarias/);
assert.match(source, /p_motivo: String\(tarifaForm\.motivo\)/);
assert.match(source, /p_motivo: String\(precioForm\.motivo\)/);
assert.match(source, /p_expected_version: Number\(zonaForm\.version\)/);
assert.match(source, /p_expected_version: Number\(mesaForm\.version\)/);

console.log("REDISENO_ORG33_SALA_CONTRACT=PASS");
