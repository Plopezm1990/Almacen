import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const archivos = [
  path.join(root, "fuente.js"),
  path.join(root, "source-recovery", "fuente-recuperado.js")
];

for (const archivo of archivos) {
  const fuente = fs.readFileSync(archivo, "utf8");
  const nombre = path.basename(archivo);

  assert.match(fuente, /"data-tpv-shell": "true"/, `${nombre}: falta la marca de puesto TPV`);
  assert.match(fuente, /"Puesto de venta"/, `${nombre}: falta la cabecera del puesto`);
  assert.match(fuente, /"Salir del TPV"/, `${nombre}: falta la salida explícita del puesto`);
  assert.match(fuente, /__salirTPV/, `${nombre}: falta el callback de salida del puesto`);
  assert.match(fuente, /body:has\(\[data-tpv-shell\]\) aside/, `${nombre}: la navegación lateral no se oculta en el puesto`);
  assert.match(fuente, /body:has\(\[data-tpv-shell\]\) \.app-main-content \+ div/, `${nombre}: la navegación inferior no se oculta en el puesto`);
  assert.match(fuente, /body:has\(\[data-tpv-shell\]\) \.app-main-content \{ max-height: none !important;/, `${nombre}: el área del puesto no ocupa el viewport`);
  assert.match(fuente, /la_suite_abc_tpv_borrador_v1/, `${nombre}: no conserva el mecanismo de borrador del TPV`);
}

console.log("DOCUMENTO2_FASE1_PUESTO_COMPLETO=PASS");
