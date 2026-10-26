import fs from "node:fs";
import assert from "node:assert/strict";

const fuente = fs.readFileSync("fuente.js", "utf8");
const esperado = [
  "cuentaId: guardado.cuentaId",
  "cuentaVersion: guardado.cuentaVersion",
  "operatingDay: guardado.operatingDay",
  "currencyCode: guardado.currencyCode",
  "modalidad: guardado.modalidad"
];

for (const fragmento of esperado) {
  assert.ok(fuente.includes(fragmento), `Falta preservar ${fragmento} en la respuesta de Enviar pedido.`);
}

console.log("ETAPA6_ENVIAR_PRESERVA_CUENTA_CONTRACT=PASS");
