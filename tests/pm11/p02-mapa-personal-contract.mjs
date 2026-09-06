import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');
const mapa = fs.readFileSync('tests/pm11/P02_MAPA_PERSONAL_ACTUAL.md', 'utf8');
const manifest = JSON.parse(fs.readFileSync('source-recovery/post-pm08-patches/PATCH_SERIES.json', 'utf8'));

const sha = crypto.createHash('sha256').update(fs.readFileSync('fuente.js')).digest('hex');
assert.equal(sha, manifest.targetArtifactSha256, 'P02 no debe modificar fuente.js respecto al artefacto reproducible PM10/G1');

for (const marker of [
  'function validarEmpleadoPM10(',
  'function crearLogicaPersonal({',
  'function Personal({',
  'function crearLogicaTurnos({',
  'function Turnos({'
]) {
  assert.ok(src.includes(marker), `falta frontera esperada: ${marker}`);
}

for (const marker of [
  'function addEmpleado(',
  'function updateEmpleado(',
  'function deleteEmpleado(',
  'function anonimizarEmpleado(',
  'registrarAusencia',
  'registrarEpi',
  'crearCuentaEmpleado',
  'crearEntrevista',
  'crearPrefiltro'
]) {
  assert.ok(src.includes(marker), `capacidad Personal no localizada: ${marker}`);
}

assert.ok(src.includes('key === "empleados"'), 'el adaptador debe reconocer la clave empleados');
assert.ok(src.includes('validarEmpleadoPM10(data, { localActivoId })'), 'alta debe conservar validación LA-017');
assert.ok(src.includes('validarEmpleadoPM10({ ...actual, ...data'), 'edición debe conservar validación LA-017');

const logicIni = src.indexOf('function crearLogicaPersonal({');
const logicFin = src.indexOf('function crearLogicaTurnos({', logicIni);
assert.ok(logicIni >= 0 && logicFin > logicIni, 'frontera Personal/Turnos no localizable');
const logic = src.slice(logicIni, logicFin);
assert.match(logic, /function deleteEmpleado\(id\)[\s\S]*?setEmpleados\(\(s22\) => s22\.filter/,
  'P02 debe detectar el borrado físico histórico para tratarlo posteriormente');

for (const marker of [
  'PM11_P02_MAPA_PERSONAL_ACTUAL=PASS',
  'SIGUIENTE=PM11_P03_CONTRATO_IDENTIDAD_CICLO_VIDA_PERSONAL',
  'No existe en QA una tabla `empleados` dedicada.',
  'cambios funcionales: **0**',
  'migraciones PM11: **0**'
]) {
  assert.ok(mapa.includes(marker), `evidencia P02 incompleta: ${marker}`);
}

assert.ok(fs.existsSync('tests/pm10/p07-personal-contract.mjs'), 'debe conservarse la regresión LA-017');

console.log('PM11 P02 mapa Personal actual: contrato OK');
