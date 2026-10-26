import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const files = [
  resolve(root, "fuente.js"),
  resolve(root, "source-recovery", "fuente-recuperado.js")
];

const marker = "/* Documento 2 · tercera pasada visual: tareas secundarias y marcos responsive */";
const required = [
  ".tpv-section-nav button:nth-child(2)[aria-selected=\"true\"]",
  ".tpv-section-nav button:nth-child(7)[aria-selected=\"true\"]",
  ".tpv-shell > .tpv-layout { display: none !important; }",
  ".tpv-shell > .mb-4:not([hidden]) { order: 40",
  ".tpv-shell > .mt-5 { display: none !important; }",
  "[data-tpv-fase5-cobro] .tpv-fase5-cash-keypad",
  "@media (min-width: 901px) and (max-width: 1100px)",
  "@media (max-width: 640px)",
  "min-height: calc(100dvh - 3.5rem)"
];

const blocks = files.map((file) => {
  const source = readFileSync(file, "utf8");
  assert(source.includes(marker), `Falta el marcador visual en ${file}`);
  const start = source.indexOf(marker);
  const end = source.indexOf("@media print", start);
  assert(start >= 0 && end > start, `No se pudo delimitar el pase visual en ${file}`);
  const block = source.slice(start, end);
  for (const fragment of required) {
    assert(block.includes(fragment), `Falta selector visual en ${file}: ${fragment}`);
  }
  return block;
});

assert.equal(blocks[0], blocks[1], "La fuente activa y la copia de recuperación deben conservar el mismo pase visual");
console.log("DOCUMENTO2_PASE_VISUAL3=PASS");
