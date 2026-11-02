import fs from "node:fs";

const source = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");
const runtime = fs.readFileSync("fuente.js", "utf8");

const required = [
  "function qaSoporteCobroActivo()",
  "function PanelSoporteCobroQa",
  'data-qa-cobro-support',
  '"abc_estado_pago_mixto_cuenta"',
  '"abc_listar_incidencias_cobro"',
  '"abc_obtener_dia_operativo_local"',
  "Solo lectura. Consulta el estado del servidor; no abre caja, no cambia el día operativo y no inicia cobros.",
  "Consultar estado QA"
];

for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`F4_B04_QA_SUPPORT_FAIL: falta ${marker}`);
}

const supportStart = source.indexOf("function PanelSoporteCobroQa");
const supportEnd = source.indexOf("function VentaRapida", supportStart);
if (supportStart < 0 || supportEnd < 0) throw new Error("F4_B04_QA_SUPPORT_FAIL: límites de panel no encontrados");
const supportBody = source.slice(supportStart, supportEnd);
const forbidden = [
  '"abc_abrir_incidencia_cobro"',
  '"abc_resolver_incidencia_cobro"',
  '"abc_iniciar_cobro"',
  '"abc_recuperar_cuenta"',
  '"abc_abrir_sesion_caja"',
  ".insert(",
  ".update(",
  ".delete("
];
for (const marker of forbidden) {
  if (supportBody.includes(marker)) throw new Error(`F4_B04_QA_SUPPORT_FAIL: operación no lectora en el panel: ${marker}`);
}

const sourceBody = source.slice(source.indexOf("var C2 = {"));
const runtimeBody = runtime.slice(runtime.indexOf("var C2 = {"));
if (sourceBody !== runtimeBody) throw new Error("F4_B04_QA_SUPPORT_FAIL: fuente.js no está materializado desde la fuente recuperada");

console.log("ABC_F4_B04_QA_SUPPORT=PASS");
