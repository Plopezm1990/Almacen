import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const doc = await readFile(new URL("../../../docs/plan-maestro/C07_D3_PILOTO_SANDBOX_EMPRESA_2026-10-27.md", import.meta.url), "utf8");
const dossier = await readFile(new URL("../../../docs/plan-maestro/C07_D2_6_EXPEDIENTE_ACTIVACION_EMPRESA_2026-10-27.md", import.meta.url), "utf8");
const adapter = await readFile(new URL("../../../docs/plan-maestro/C07_D2_5_CONTRATO_ADAPTADOR_SANDBOX_2026-10-27.md", import.meta.url), "utf8");

test("C07-D.3 exige una empresa real, un sandbox externo y alcance aislado", () => {
  assert.match(doc, /PENDIENTE_EMPRESA/);
  assert.match(doc, /empresa piloto identificada/);
  assert.match(doc, /NIF y razón social verificados/);
  assert.match(doc, /un local inicial/);
  assert.match(doc, /no se reutilizan credenciales,\s*series,\s*snapshots/i);
  assert.match(doc, /SANDBOX externo/iu);
});

test("el simulador QA no puede cerrar el piloto ni activar producción", () => {
  assert.match(doc, /no se puede cerrar con datos inventados/);
  assert.match(doc, /SIMULADOR_C07D.*QA/isu);
  assert.match(doc, /PRODUCTION_ENABLED.*no forma parte/isu);
  assert.match(doc, /no se modifica Supabase de producción/);
  assert.match(doc, /no se cambia ningún estado a `TEST_PASS` o `PRODUCTION_ENABLED`/);
});

test("el piloto exige identidad, representación, adaptador, QR y hardware", () => {
  for (const requirement of [
    "PILOTO_IDENTIDAD_NO_VERIFICADA",
    "PILOTO_REPRESENTACION_NO_ACREDITADA",
    "PILOTO_ADAPTADOR_NO_ELEGIDO",
    "PILOTO_SANDBOX_NO_COTEJADO",
    "PILOTO_QR_NO_COTEJADO",
    "PILOTO_HARDWARE_NO_PROBADO",
  ]) assert.match(doc, new RegExp(requirement));
  assert.match(doc, /doble aprobación/iu);
  assert.match(dossier, /empresa piloto/iu);
  assert.match(adapter, /idempotency_key/);
});

test("los secretos quedan fuera del frontend, commits, fixtures y logs", () => {
  assert.match(doc, /Nunca se copian en el frontend, en fixtures, en commits, en logs/);
  assert.match(doc, /credencial opaca/);
  assert.match(doc, /sin el secreto/);
});

console.log("C07D_D3_PILOT_SANDBOX_CONTRACT=PASS");
