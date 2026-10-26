import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const files = [
  resolve(root, "fuente.js"),
  resolve(root, "source-recovery", "fuente-recuperado.js")
];

const required = [
  "/* Documento 2 · primera pasada visual del puesto TPV */",
  "/* Documento 2 · segunda pasada visual: venta primero, herramientas después */",
  "/* Documento 2 · tercera pasada visual: tareas secundarias y marcos responsive */",
  "/* Documento 2 · A04 Opciones: acceso visual 3x3 sin crear rutas paralelas */",
  ".tpv-product-zone, .tpv-ticket-zone { min-width: 0; }",
  ".tpv-product-zone > div:nth-child(3) { grid-template-columns: repeat(3, minmax(0, 1fr));",
  ".tpv-product-zone > div:nth-child(3) { grid-template-columns: repeat(2, minmax(0, 1fr));",
  ".tpv-ticket-zone { order: 60; }",
  ".tpv-options-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));",
  ".tpv-options-grid { grid-template-columns: repeat(2, minmax(0, 1fr));",
  ".tpv-options-trigger:focus-visible",
  ".tpv-option-card:focus-visible",
  "Puente L&A (opcional, en este ordenador)",
  "Cajón monedero",
  "Abrir cajón (simulado)",
  "Imprimir ticket (simulado)",
  "Todavía sin verificar con una impresora real."
];

const sources = files.map((file) => {
  const source = readFileSync(file, "utf8");
  for (const fragment of required) {
    assert(source.includes(fragment), `Falta evidencia A03/A04/A17 en ${file}: ${fragment}`);
  }
  return source;
});

const extract = (source, startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert(start >= 0 && end > start, `No se pudo delimitar el bloque ${startMarker}`);
  return source.slice(start, end);
};

const visualBlocks = sources.map((source) => extract(
  source,
  "/* Documento 2 · tercera pasada visual: tareas secundarias y marcos responsive */",
  "/* Documento 2 · A04 Opciones: acceso visual 3x3 sin crear rutas paralelas */"
));
const optionsBlocks = sources.map((source) => extract(
  source,
  "/* Documento 2 · A04 Opciones: acceso visual 3x3 sin crear rutas paralelas */",
  "@media print"
));

assert.equal(visualBlocks[0], visualBlocks[1], "El bloque visual A03/A17 debe estar sincronizado en ambas fuentes");
assert.equal(optionsBlocks[0], optionsBlocks[1], "El bloque visual A04 debe estar sincronizado en ambas fuentes");
console.log("DOCUMENTO2_REVISION_FINAL_A03_A04_A17=PASS");
