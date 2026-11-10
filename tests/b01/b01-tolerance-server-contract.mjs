import assert from "node:assert/strict";
import fs from "node:fs";

const cliente = fs.readFileSync("fuente.js", "utf8");
const servidor = fs.readFileSync("supabase/functions/importar-factura/index.ts", "utf8");

assert.match(
  cliente,
  /function validarFacturaAgrupada\(\{ factura, albaranesClasificados = \[\], tolerancia = 0\.12 \}\)/,
  "el cliente conserva la tolerancia declarada de 0,12 €"
);
assert.match(
  cliente,
  /Math\.abs\(totalDocumento - totales\.total\) > tolerancia/,
  "el cliente valida el total de la factura con la tolerancia"
);
assert.match(
  cliente,
  /Math\.abs\(totalAlbaranes - totales\.total\) > tolerancia/,
  "el cliente valida la suma de albaranes con la tolerancia"
);
assert.match(
  servidor,
  /Math\.abs\(totalCalculado - totalFactura\) > 0\.12/,
  "el servidor valida el total de la factura con 0,12 €"
);
assert.match(
  servidor,
  /Math\.abs\(totalAlbaranes - totalFactura\) > 0\.12/,
  "el servidor valida la suma de albaranes con 0,12 €"
);

console.log("B01_TOLERANCE_CLIENT_SERVER_CONTRACT=PASS");
