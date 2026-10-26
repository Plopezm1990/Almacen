import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fuentes = ["fuente.js", "source-recovery/fuente-recuperado.js"];
for (const archivo of fuentes) {
  const source = await readFile(resolve(root, archivo), "utf8");
  const quickIndex = source.lastIndexOf("className: \"tpv-quick-quantity\"");
  const cardStart = source.lastIndexOf("return /* @__PURE__ */ import_react4.default.createElement(", quickIndex);
  assert.ok(quickIndex >= 0, `${archivo}: falta el marcador de cantidad rápida`);
  assert.ok(cardStart >= 0, `${archivo}: falta la tarjeta de producto TPV`);
  const cardSnippet = source.slice(cardStart, quickIndex + 180);
  assert.match(cardSnippet, /createElement\(\s*\n?\s*"div",[\s\S]*role: "button",[\s\S]*"aria-disabled":/, `${archivo}: la tarjeta TPV debe ser un control no anidable`);
  assert.match(source, /className: "tpv-quick-quantity"/, `${archivo}: faltan los botones de cantidad rápida`);
}

console.log("TPV_QUICK_QUANTITY_NO_NESTED_BUTTONS=PASS");
