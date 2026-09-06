import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');
const mapa = fs.readFileSync('tests/pm11/P02_MAPA_PERSONAL_ACTUAL.md', 'utf8');

// P02 solo congela el mapa. La regresión LA-017 se ejecuta como test separado
// y el workflow comprueba además que fuente.js/migraciones no cambiaron desde G1.
for (const marker of [
  'function validarEmpleadoPM10(',
  'function crearLogicaPersonal({',
  'function Personal({',
  'function crearLogicaTurnos({'
]) {
  assert.ok(src.includes(marker), `falta frontera esperada: ${marker}`);
}

const logicIni = src.indexOf('function crearLogicaPersonal({');
const logicFin = src.indexOf('function crearLogicaTurnos({', logicIni);
assert.ok(logicIni >= 0 && logicFin > logicIni, 'frontera Personal/Turnos no localizable');
const logic = src.slice(logicIni, logicFin);

for (const marker of [
  'function addEmpleado(',
  'function updateEmpleado(',
  'function deleteEmpleado(',
  'function anonimizarEmpleado('
]) {
  assert.ok(logic.includes(marker), `operación de ciclo de vida no localizada: ${marker}`);
}

assert.ok(logic.includes('setEmpleados'), 'el dominio Personal debe seguir gestionando la colección empleados');
assert.ok(fs.existsSync('tests/pm10/p07-personal-contract.mjs'), 'debe conservarse la regresión LA-017');

for (const marker of [
  'PM11_P02_MAPA_PERSONAL_ACTUAL=PASS',
  'SIGUIENTE=PM11_P03_CONTRATO_IDENTIDAD_CICLO_VIDA_PERSONAL',
  'No existe en QA una tabla `empleados` dedicada.',
  'cambios funcionales: **0**',
  'migraciones PM11: **0**',
  '`public.perfiles`',
  '`public.membresias_usuario`',
  '`public.prefiltros_candidatos`'
]) {
  assert.ok(mapa.includes(marker), `evidencia P02 incompleta: ${marker}`);
}

console.log('PM11 P02 mapa Personal actual: contrato OK');
