import fs from "node:fs";

const source = fs.readFileSync("index-storage-bootstrap.js", "utf8");
const helperStart = source.indexOf("async function leerFilasPorIds(");
const helperEnd = source.indexOf("async function leerFilasCompletas(", helperStart);
const syncStart = source.indexOf("async function sincronizarColeccionPorFila(");
const syncEnd = source.indexOf("/* ----------------------------------------------------------", syncStart);

if (helperStart < 0 || helperEnd < 0) {
  throw new Error("ETAPA7_MOVIMIENTOS_READ_SCOPE_FAIL: falta helper de lectura por IDs");
}
if (syncStart < 0 || syncEnd < 0) {
  throw new Error("ETAPA7_MOVIMIENTOS_READ_SCOPE_FAIL: falta sincronizador por fila");
}

const helper = source.slice(helperStart, helperEnd);
const sync = source.slice(syncStart, syncEnd);

if (!helper.includes('.select("id, datos").in("id", loteIds)')) {
  throw new Error("ETAPA7_MOVIMIENTOS_READ_SCOPE_FAIL: la lectura no está acotada por clave primaria");
}
if (!sync.includes("var apuntados = claveColeccion ? borradosDe(claveColeccion) : []")) {
  throw new Error("ETAPA7_MOVIMIENTOS_READ_SCOPE_FAIL: no se consideran borrados explícitos");
}
if (!sync.includes("var idsParaComparar = filasSubibles.map(function (x) { return x.id; }).concat(apuntados)")) {
  throw new Error("ETAPA7_MOVIMIENTOS_READ_SCOPE_FAIL: falta el conjunto de IDs comparables");
}
if (!sync.includes("var filasRemotas = await leerFilasPorIds(tabla, idsParaComparar)")) {
  throw new Error("ETAPA7_MOVIMIENTOS_READ_SCOPE_FAIL: el sincronizador sigue sin usar la lectura acotada");
}
if (sync.includes("await leerFilasCompletas(tabla)")) {
  throw new Error("ETAPA7_MOVIMIENTOS_READ_SCOPE_FAIL: el guardado vuelve a leer el histórico completo");
}
if (!sync.includes("if (!filasSubibles.length && !apuntados.length) return;")) {
  throw new Error("ETAPA7_MOVIMIENTOS_READ_SCOPE_FAIL: una cola de borrado no puede quedar bloqueada por la lista filtrada");
}
if (!sync.includes('from(tabla).delete().in("id", idsParaBorrar)')) {
  throw new Error("ETAPA7_MOVIMIENTOS_READ_SCOPE_FAIL: se perdió el borrado por IDs confirmados");
}

console.log("ETAPA7_MOVIMIENTOS_READ_SCOPE_CONTRACT=PASS");
