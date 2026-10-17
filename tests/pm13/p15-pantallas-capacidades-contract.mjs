import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("fuente.js", "utf8");
const recovered = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");
const documentation = fs.readFileSync(
  "docs/plan-empresas/PM13_P04_02_IDENTIFICADORES_CONSULTA_2026-10-17.md",
  "utf8",
);

function extract(sourceText) {
  const start = sourceText.indexOf("const CAPACIDADES_CONSULTA_PANTALLA = Object.freeze({");
  const end = sourceText.indexOf("const itemsMeta", start);
  assert.ok(start >= 0 && end > start, "mapa de capacidades no encontrado");
  const block = sourceText.slice(start, end);
  return [...block.matchAll(/^\s{4}([a-z0-9_]+): "([A-Z0-9_]+)"[,]?$/gm)].map((match) => ({
    id: match[1],
    capacidad: match[2],
  }));
}

const capacidades = extract(source);
const capacidadesRecuperadas = extract(recovered);
assert.equal(capacidades.length, 45);
assert.deepEqual(capacidadesRecuperadas, capacidades);
assert.equal(new Set(capacidades.map(({ id }) => id)).size, 45);
assert.equal(new Set(capacidades.map(({ capacidad }) => capacidad)).size, 45);
for (const { id, capacidad } of capacidades) {
  assert.match(capacidad, /^ABC_PANTALLA_[A-Z0-9_]+_CONSULTAR$/);
  assert.ok(documentation.includes(`\`${id}\` | \`${capacidad}\``), `documentación sin ${id}`);
}

assert.match(source, /capacidadConsulta: CAPACIDADES_CONSULTA_PANTALLA\[item\.id\]/);
assert.match(source, /label: "Panel general"/);
assert.match(documentation, /no persiste selecciones/);

console.log("PM13 P15 Capacidades de consulta: 45 claves estables separadas de navegación y etiquetas OK");
