import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../../fuente.js", import.meta.url), "utf8");

test("el expediente C07-D.3 solo se muestra en preview QA y se lee por alcance", () => {
  assert.match(source, /abc_c07d_leer_piloto_sandbox/);
  assert.match(source, /data-c07d-d3-pilot.*readonly-qa/);
  assert.match(source, /deploy-preview-\\d\+--/u);
  assert.match(source, /p_empresa_id: empresaId/);
  assert.match(source, /p_local_id: localId/);
  assert.match(source, /p_entidad_fiscal_id: emisorId/);
});

test("la vista del piloto no puede guardar, activar ni transportar", () => {
  const panelStart = source.indexOf('"data-c07d-d3-pilot"');
  const panelEnd = source.indexOf('h(Card, { className: "mb-3", style: { background: C2.amberSoft }', panelStart);
  assert.ok(panelStart >= 0 && panelEnd > panelStart);
  const panel = source.slice(panelStart, panelEnd);
  assert.match(panel, /Solo lectura en preview QA/);
  assert.match(panel, /no crea expedientes/);
  assert.match(panel, /no cambia estados/);
  assert.match(panel, /no utiliza secretos/);
  assert.match(panel, /no activa producción/);
  assert.doesNotMatch(panel, /abc_c07d_guardar_piloto_sandbox/);
});

test("la vista muestra el estado vacío correcto cuando todavía no hay empresa piloto", () => {
  assert.match(source, /PENDIENTE_EMPRESA/);
  assert.match(source, /pilotoSandboxConfigurado/);
  assert.match(source, /Entorno SANDBOX/);
});

console.log("C07D_D3_PILOT_SANDBOX_UI=PASS");
