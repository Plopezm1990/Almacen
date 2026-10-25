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

  assert.match(fuente, /data-tpv-catalog-ticket/, `${nombre}: falta el bloque explícito de catálogo y ticket`);
  assert.match(fuente, /"Catálogo y ticket"/, `${nombre}: falta la identificación del flujo catálogo-ticket`);
  assert.match(fuente, /"Catálogo"/, `${nombre}: falta el resumen del catálogo`);
  assert.match(fuente, /"Ticket"/, `${nombre}: falta el resumen del ticket`);
  assert.match(fuente, /vendibles\.length/, `${nombre}: el catálogo no expone el recuento de productos`);
  assert.match(fuente, /lineasCarrito\.length/, `${nombre}: el ticket no expone el recuento de líneas`);
  assert.match(fuente, /fmt\(total\)/, `${nombre}: el resumen del ticket no expone el total visible`);
  assert.match(fuente, /tpv-fase3-flow/, `${nombre}: falta el layout responsive del flujo`);
  assert.match(fuente, /tpv-layout/, `${nombre}: se ha perdido la separación catálogo-ticket existente`);
  assert.match(fuente, /server-side/, `${nombre}: falta recordar que el total definitivo lo confirma el servidor`);
}

console.log("DOCUMENTO2_FASE3_CATALOGO_TICKET=PASS");
