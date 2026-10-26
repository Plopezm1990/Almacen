import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const files = [
  resolve(root, "fuente.js"),
  resolve(root, "source-recovery", "fuente-recuperado.js")
];

const cssMarker = "/* Documento 2 · A05/A06: Mesas y Pedido como tareas dedicadas */";
const cssBlocks = [];

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const cssStart = source.indexOf(cssMarker);
  const cssEnd = source.indexOf("@media print", cssStart);
  assert(cssStart >= 0 && cssEnd > cssStart, `No se pudo delimitar A05/A06 en ${file}`);
  const css = source.slice(cssStart, cssEnd);
  for (const fragment of [
    ".tpv-task-card {",
    ".tpv-task-card--accounts",
    ".tpv-task-card--sala",
    ".tpv-task-card--pedido",
    "min-height: 112px",
    "outline: 3px solid var(--c-focus-ring)",
    "grid-template-columns: repeat(2",
    "min-height: 48px"
  ]) {
    assert(css.includes(fragment), `Falta el ajuste A05/A06 en ${file}: ${fragment}`);
  }
  cssBlocks.push(css);

  const accountsStart = source.indexOf("function renderCuentasRecuperablesA06()");
  const salaStart = source.indexOf("function renderSalaA07()");
  const pedidoStart = source.indexOf("function renderPedidoOperativoA05()");
  assert(accountsStart >= 0 && salaStart > accountsStart && pedidoStart > salaStart, `Faltan funciones A05/A06 en ${file}`);
  const accounts = source.slice(accountsStart, salaStart);
  const sala = source.slice(salaStart, pedidoStart);
  const pedidoEnd = source.indexOf("\n  return /* @__PURE__ */ import_react4.default.createElement(\"div\", { className: \"tpv-shell\"", pedidoStart);
  assert(pedidoEnd > pedidoStart, `No se pudo delimitar el pedido operativo en ${file}`);
  const pedido = source.slice(pedidoStart, pedidoEnd);
  assert(accounts.includes("tpv-task-card--accounts"), `La tarjeta de cuentas no está marcada en ${file}`);
  assert(sala.includes("tpv-task-card--sala"), `La tarjeta de sala no está marcada en ${file}`);
  assert(pedido.includes("tpv-task-card--pedido"), `La tarjeta de pedido no está marcada en ${file}`);
  assert(accounts.includes("Cuentas aparcadas / recuperables"), `Falta el contenido de cuentas en ${file}`);
  assert(sala.includes("Sala y mesas"), `Falta el contenido de sala en ${file}`);
  assert(pedido.includes("Pedido operativo"), `Falta el contenido de pedido en ${file}`);
}

assert.equal(cssBlocks[0], cssBlocks[1], "El CSS A05/A06 debe ser idéntico en la fuente activa y la recuperación");
console.log("DOCUMENTO2_A05_A06_TAREAS=PASS");
