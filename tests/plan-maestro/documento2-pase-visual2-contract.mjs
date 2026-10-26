import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const files = [
  resolve(root, "fuente.js"),
  resolve(root, "source-recovery", "fuente-recuperado.js")
];

const marker = "/* Documento 2 · segunda pasada visual: venta primero, herramientas después */";
const required = [
  "body:has([data-tpv-shell]) .tpv-shell > .tpv-layout { order: 40",
  "body:has([data-tpv-shell]) .tpv-shell > .tpv-section-nav { order: 50",
  "body:has([data-tpv-shell]) .tpv-shell > [data-tpv-catalog-ticket] { display: none",
  ".tpv-layout { grid-template-columns: minmax(0, 1fr) minmax(292px, 33%)",
  ".tpv-section-nav button[aria-selected=\"true\"] { background: var(--c-accent-soft)",
  "@media (max-width: 900px)",
  "@media (max-width: 640px)"
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
console.log("DOCUMENTO2_PASE_VISUAL2=PASS");
