import fs from "node:fs";

const source = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");
const runtime = fs.readFileSync("fuente.js", "utf8");

const required = [
  "async function abrirIncidenciaCobroF4",
  "async function resolverIncidenciaCobroF4",
  '"abc_abrir_incidencia_cobro"',
  '"abc_resolver_incidencia_cobro"',
  '"abc_listar_incidencias_cobro"',
  "Abrir incidencia B04",
  "Resolver incidencia",
  "Solo un Propietario o Encargado puede resolver esta incidencia."
];

for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`F4_B04_UI_FAIL: falta ${marker}`);
}

if (source.includes('"abc_resolver_intento"')) {
  throw new Error("F4_B04_UI_FAIL: la interfaz no debe llamar al resolver interno de proveedor");
}

const sourceBody = source.slice(source.indexOf("var C2 = {"));
const runtimeBody = runtime.slice(runtime.indexOf("var C2 = {"));
if (sourceBody !== runtimeBody) throw new Error("F4_B04_UI_FAIL: fuente.js no está materializado desde la fuente recuperada");

console.log("ABC_F4_B04_UI=PASS");
