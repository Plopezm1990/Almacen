import fs from "node:fs";
import assert from "node:assert/strict";

const fuente = fs.readFileSync(new URL("../../fuente.js", import.meta.url), "utf8");

for (const tipo of ["proveedores", "fichasCosto", "empleados", "clientes"]) {
  assert.match(
    fuente,
    new RegExp(`navegacionObjetivoPM15\\?\\.tipo === "${tipo}"`),
    `La navegación no pasa el objetivo de búsqueda para ${tipo}`
  );
}

for (const expresion of [
  "function Proveedores({",
  "function FichasCosto({",
  "function Personal({",
  "function Clientes({",
  "const objetivo = proveedores.find((pv) => pv.id === navegacionObjetivoId)",
  "const objetivo = fichasCosto.find((f22) => f22.id === navegacionObjetivoId)",
  "const objetivo = empleados.find((e2) => e2.id === navegacionObjetivoId)",
  "const objetivo = analisisClientes.find((c22) => c22.id === navegacionObjetivoId)"
]) {
  assert.ok(fuente.includes(expresion), `Falta contrato de navegación: ${expresion}`);
}

console.log("PM20 P07 destino concreto de búsqueda: contrato estático OK");
