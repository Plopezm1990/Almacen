import fs from "node:fs";
import assert from "node:assert/strict";

const archivos = ["fuente.js", "source-recovery/fuente-recuperado.js"];
const bloques = [];

for (const archivo of archivos) {
  const source = fs.readFileSync(archivo, "utf8");
  const bloque = source.match(/var clavesMovimientoDashboardLegacy[\s\S]*?(?=\nfunction EstadoCargaDatosPM12)/)?.[0];

  assert.ok(bloque, `${archivo}: falta el generador de claves de movimientos`);
  assert.equal(
    (source.match(/key: claveMovimientoDashboard\(m22\)/g) || []).length,
    2,
    `${archivo}: Dashboard y ResumenAlmacen deben usar la clave segura`
  );
  assert.doesNotMatch(
    source,
    /movimientos\.slice\(0, 8\)[\s\S]{0,500}?key: m22\.id/,
    `${archivo}: queda una lista reciente dependiente exclusivamente de m22.id`
  );

  const claveMovimientoDashboard = new Function(`${bloque}\nreturn claveMovimientoDashboard;`)();
  assert.equal(claveMovimientoDashboard({ id: "mov-1" }), "mov-1", `${archivo}: debe conservar el id persistido`);
  assert.equal(
    claveMovimientoDashboard({ datos: { movimientoId: "mov-pm12" } }),
    "mov-pm12",
    `${archivo}: debe aceptar el identificador de PM12`
  );

  const legadoA = { motivo: "legacy" };
  const legadoB = { motivo: "legacy" };
  const claveA = claveMovimientoDashboard(legadoA);
  assert.equal(claveMovimientoDashboard(legadoA), claveA, `${archivo}: la clave de un objeto debe ser estable`);
  assert.notEqual(claveMovimientoDashboard(legadoB), claveA, `${archivo}: dos movimientos sin id deben tener claves distintas`);

  bloques.push(bloque);
}

assert.equal(bloques[0], bloques[1], "fuente.js y fuente-recuperado.js perdieron paridad en la corrección");

console.log("P1 Dashboard movimientos: claves React estables y paridad OK");
