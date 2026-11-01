import fs from "node:fs";

const source = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");
const runtime = fs.readFileSync("fuente.js", "utf8");

const readStart = source.indexOf("async function leerEstadoCobroF4()");
const readEnd = source.indexOf("\n  async function abrirIncidenciaCobroF4", readStart);
if (readStart < 0 || readEnd <= readStart) throw new Error("F4_PHASE1_FAIL: no se pudo aislar la lectura de cobro");
const readBlock = source.slice(readStart, readEnd);

if (!readBlock.includes('supabase.rpc("abc_estado_pago_mixto_cuenta"')) {
  throw new Error("F4_PHASE1_FAIL: falta la RPC autoritativa de estado mixto");
}
if (readBlock.includes('.from("pago_intentos")')) {
  throw new Error("F4_PHASE1_FAIL: la UI vuelve a leer directamente pago_intentos");
}
if (!readBlock.includes("Array.isArray(detalleB05?.intentos)")) {
  throw new Error("F4_PHASE1_FAIL: los intentos no se consumen desde el detalle B05");
}

const uiStart = source.indexOf("function sincronizarImporteCobroF4(resultado)");
const uiEnd = source.indexOf("\n  function cambiarFormularioIncidenciaB04", uiStart);
if (uiStart < 0 || uiEnd <= uiStart) throw new Error("F4_PHASE1_FAIL: no se pudo aislar la sincronización de cobro");
const uiBlock = source.slice(uiStart, uiEnd);
if (!uiBlock.includes("setImporteCobroF4(Number.isFinite(saldo) && saldo > 0 ? saldo.toFixed(2) : \"\")")) {
  throw new Error("F4_PHASE1_FAIL: el saldo autoritativo no actualiza el importe del siguiente pago");
}
if (!uiBlock.includes('setImporteCobroF4("")') || !uiBlock.includes('setEfectivoRecibidoCobroF4("")')) {
  throw new Error("F4_PHASE1_FAIL: un estado de cobro desconocido podría conservar un importe anterior");
}
const callers = ["refrescarCobroF4", "ejecutarCobroF4", "recuperarCobroF4UI"];
for (const caller of callers) {
  const callerStart = source.indexOf(`async function ${caller}(`);
  const laterStarts = callers
    .map((candidate) => source.indexOf(`async function ${candidate}(`, callerStart + 1))
    .filter((index) => index > callerStart);
  const callerEnd = Math.min(
    ...(laterStarts.length ? laterStarts : [source.indexOf("\n  function cambiarFormularioIncidenciaB04", callerStart)])
  );
  if (callerStart < 0 || callerEnd <= callerStart || !source.slice(callerStart, callerEnd).includes("sincronizarImporteCobroF4(resultado);")) {
    throw new Error(`F4_PHASE1_FAIL: falta sincronización de importe en ${caller}`);
  }
}
if (!source.includes('label: "Exacto para este pago (€)"')) {
  throw new Error("F4_PHASE1_FAIL: falta la etiqueta operativa del importe");
}

const sourceBody = source.slice(source.indexOf("var C2 = {"));
const runtimeBody = runtime.slice(runtime.indexOf("var C2 = {"));
if (sourceBody !== runtimeBody) throw new Error("F4_PHASE1_FAIL: fuente.js no está materializado desde la fuente recuperada");

console.log("ABC_F4_PHASE1_REGRESSION=PASS");
