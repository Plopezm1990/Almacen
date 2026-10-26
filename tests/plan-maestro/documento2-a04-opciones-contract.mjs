import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const files = [
  resolve(root, "fuente.js"),
  resolve(root, "source-recovery", "fuente-recuperado.js")
];

const cssMarker = "/* Documento 2 · A04 Opciones: acceso visual 3x3 sin crear rutas paralelas */";
const functionMarker = "function abrirOpcionTpvA04(id)";
const labels = [
  "Mesas y cuentas",
  "Pedido actual",
  "Cobrar",
  "Cocina",
  "Caja",
  "Calculadora",
  "Documentos y correo",
  "Descuento/cortesía",
  "Vales regalo"
];

const cssBlocks = [];
const optionFunctions = [];

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const cssStart = source.indexOf(cssMarker);
  const cssEnd = source.indexOf("@media print", cssStart);
  assert(cssStart >= 0 && cssEnd > cssStart, `No se pudo delimitar A04 en ${file}`);
  const css = source.slice(cssStart, cssEnd);
  for (const fragment of [
    ".tpv-options-grid { display: grid; grid-template-columns: repeat(3",
    ".tpv-option-card",
    "data-tpv-panel=\"opciones\"",
    ".tpv-shell > .tpv-layout",
    ".tpv-shell > .tpv-ticket-zone",
    "grid-template-columns: repeat(2"
  ]) {
    assert(css.includes(fragment), `Falta el ajuste A04 en ${file}: ${fragment}`);
  }
  cssBlocks.push(css);

  const fnStart = source.indexOf(functionMarker);
  const fnEnd = source.indexOf("function renderMovimientosCajaTpv()", fnStart);
  assert(fnStart >= 0 && fnEnd > fnStart, `Falta la función A04 en ${file}`);
  const fn = source.slice(fnStart, fnEnd);
  for (const label of labels) assert(fn.includes(`\"${label}\"`), `Falta tarjeta A04 en ${file}: ${label}`);
  for (const fragment of [
    "function abrirOpcionTpvA04(id)",
    "data-tpv-option",
    "setCalculadoraA04"
  ]) {
    assert(fn.includes(fragment), `Falta integración A04 en ${file}: ${fragment}`);
  }
  assert(source.includes("panelTpv(\"opciones\", renderOpcionesTpvA04())"), `Falta el panel A04 en ${file}`);
  assert(source.includes("tpv-options-trigger"), `Falta el acceso A04 en ${file}`);
  optionFunctions.push(fn);
}

assert.equal(cssBlocks[0], cssBlocks[1], "El CSS A04 debe ser idéntico en la fuente activa y la recuperación");
assert.equal(optionFunctions[0], optionFunctions[1], "La implementación A04 debe ser idéntica en la fuente activa y la recuperación");
console.log("DOCUMENTO2_A04_OPCIONES=PASS");
