import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../../fuente.js", import.meta.url), "utf8");

test("el worker QA usa un botón nativo con tipo explícito y guard de doble clic", () => {
  assert.match(source, /data-c07d-process-queue/);
  assert.match(source, /type: "button"/);
  assert.match(source, /procesandoColaQaRef/);
  assert.match(source, /procesarColaFiscalQaC07D\(10\)/);
});

test("el resultado del worker sigue rotulado como QA sin transporte AEAT", () => {
  assert.match(source, /No se ha contactado con la AEAT/);
  assert.match(source, /modo: "QA_SIMULADOR"/);
});
