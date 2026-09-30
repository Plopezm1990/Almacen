import fs from "node:fs";

const source = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");
const runtime = fs.readFileSync("fuente.js", "utf8");

const required = [
  '"abc_estado_pago_mixto_cuenta"',
  "opciones?.importeObjetivo",
  "p_importe_recibido: medio === \"EFECTIVO\" ? pendiente.importeRecibido : null",
  "p_cambio_entregado: medio === \"EFECTIVO\" ? pendiente.cambioEntregado : null",
  "Importe de este pago (€)",
  "Efectivo recibido (€)",
  "Cambio a devolver",
  "Completar pago mixto con tarjeta",
  "saldo que devuelve el servidor"
];

for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`F4_B05_UI_FAIL: falta ${marker}`);
}

const sourceBody = source.slice(source.indexOf("var C2 = {"));
const runtimeBody = runtime.slice(runtime.indexOf("var C2 = {"));
if (sourceBody !== runtimeBody) throw new Error("F4_B05_UI_FAIL: fuente.js no está materializado desde la fuente recuperada");

console.log("ABC_F4_B05_UI=PASS");
