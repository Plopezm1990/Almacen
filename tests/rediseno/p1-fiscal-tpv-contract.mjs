import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
const fuente = fs.readFileSync(path.join(root, "fuente.js"), "utf8");
const recuperada = fs.readFileSync(path.join(root, "source-recovery", "fuente-recuperado.js"), "utf8");

for (const [nombre, source] of [["fuente.js", fuente], ["fuente-recuperado.js", recuperada]]) {
  assert.match(source, /data-tpv31-factura-empresa/, `${nombre}: falta la superficie tpv-31`);
  assert.match(source, /Solicitar factura a empresa/, `${nombre}: falta la acción de factura completa`);
  assert.match(source, /abc_clasificar_documento/, `${nombre}: falta el RPC C06 de clasificación`);
  assert.match(source, /FACTURA_COMPLETA/, `${nombre}: falta el tipo documental completo`);
  assert.match(source, /abc_reservar_numero_documental/, `${nombre}: falta reservar el nuevo documento completo`);
  assert.match(source, /abc_resolver_emision_documental/, `${nombre}: falta resolver la emisión del nuevo documento completo`);
  assert.match(source, /abc_conservar_documento_emitido/, `${nombre}: falta el RPC C08 de conservación`);
  assert.match(source, /qa_only: true/, `${nombre}: la UI fiscal debe declarar el alcance QA`);
  assert.match(source, /aeat_transport: "DISABLED"/, `${nombre}: la UI no debe insinuar transporte AEAT real`);
  assert.match(source, /La factura completa necesita conexión con el servidor/, `${nombre}: falta el error accionable sin conexión`);
}

console.log("REDISENO_P1_FISCAL_TPV_CONTRACT=PASS");
