import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("fuente.js", "utf8");
const recovered = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");
const documentation = fs.readFileSync(
  "docs/plan-empresas/PM13_P04_03_EDITOR_PANTALLAS_2026-10-17.md",
  "utf8",
);

for (const [file, text] of [["fuente.js", source], ["source-recovery/fuente-recuperado.js", recovered]]) {
  const catalogStart = text.indexOf("var PM13_PANTALLAS_EDITOR = Object.freeze([");
  const catalogEnd = text.indexOf("var TAB_PRIORITIES_MOVIL", catalogStart);
  const catalogBlock = text.slice(catalogStart, catalogEnd);
  assert.equal((catalogBlock.match(/\["[^"]+", "[a-z0-9_]+", "[^"]+", "ABC_PANTALLA_[A-Z0-9_]+_CONSULTAR"\]/g) || []).length, 45, `${file}: el editor debe cubrir 45 pantallas`);
  assert.match(text, /var PM13_PANTALLAS_EDITOR = Object\.freeze\(\[/, `${file}: falta el catálogo del editor`);
  assert.match(text, /\.map\(\(\[grupo, id, label, capacidadConsulta\]\) => Object\.freeze\(\{ grupo, id, label, capacidadConsulta, descripcion: `Consulta de \$\{label\}`, moduloActivo: true \}\)\)/, `${file}: catálogo no normalizado`);
  assert.match(text, /function ConfigCargos\(\{ empresa = null/, `${file}: ConfigCargos no recibe la empresa`);
  assert.match(text, /Editar pantallas/, `${file}: falta abrir el editor`);
  assert.match(text, /Permitida para este cargo/, `${file}: falta estado permitido`);
  assert.match(text, /Denegada por este cargo/, `${file}: falta estado denegado`);
  assert.match(text, /Módulo no contratado o inactivo/, `${file}: falta estado de módulo inactivo`);
  assert.match(text, /Todavía no guarda la selección en el servidor/, `${file}: falta límite de persistencia`);
  assert.match(text, /consultar.*no concede crear, editar, exportar, anular ni configurar/s, `${file}: falta separar consulta de acciones`);
}

assert.match(documentation, /45 pantallas/);
assert.match(documentation, /Módulo no contratado o inactivo/);
assert.match(documentation, /no se guarda todavía en el servidor/);
assert.match(documentation, /punto 5/);

console.log("PM13 P16 Editor de pantallas: agrupación, estados y límites de acciones OK");
