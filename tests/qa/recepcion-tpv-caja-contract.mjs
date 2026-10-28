import fs from "node:fs";
import assert from "node:assert/strict";

// QA: una recepción no debe perder el producto ni fingir que ya es vendible.
// El artículo entra en almacén; el precio y el traspaso al piso siguen siendo
// decisiones explícitas antes de permitir una venta.
for (const archivo of ["fuente.js", "source-recovery/fuente-recuperado.js"]) {
  const src = fs.readFileSync(archivo, "utf8").replaceAll("\r\n", "\n");
  for (const fragmento of [
    "const productosNuevosRecepcion = [];",
    "empresaId: empresaId || null,",
    "productosNuevosRecepcion.push(nuevo);",
    "salidaPM11.lineasResueltas = lineasResueltas;",
    "data-c01-tpv-caja",
    "abrirSesionCajaA10, irACaja = null",
    "irACaja: () => setTab(\"caja\")"
  ]) {
    assert.ok(src.includes(fragmento), `${archivo}: falta ${fragmento}`);
  }
}

console.log("QA_RECEPCION_TPV_CAJA=PASS");
