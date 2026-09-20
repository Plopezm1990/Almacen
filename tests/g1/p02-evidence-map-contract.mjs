import fs from 'node:fs';
import assert from 'node:assert/strict';

const mustExist = [
  'tests/g1/P01_CHECKPOINT_INICIO.md',
  'tests/g1/P02_MAPA_EVIDENCIAS_F1.md',
  'source-recovery/PM01_CIERRE.md',
  'docs/plan-maestro/PM-02-aislamiento-qa-2026-09-04.md',
  'docs/plan-maestro/PM02_LA023_EVIDENCIA.txt',
  'docs/plan-maestro/PM03_APROBACIONES.txt',
  'docs/plan-maestro/PM04_EVIDENCIA.md',
  'tests/pm04/regression-catalog.json',
  'docs/plan-maestro/PM05_EVIDENCIA.md',
  'tests/pm05/backend-results.json',
  'tests/pm05/frontend-contract.mjs',
  '.github/workflows/pm06-aplicar-identidad-financiera.yml',
  'docs/plan-maestro/PM07_EVIDENCIA.md',
  'tests/pm07/frontend-contract.mjs',
  'docs/plan-maestro/PM08_EVIDENCIA.md',
  'tests/pm08/frontend-contract.mjs',
  'tests/pm08/migration-contract.mjs',
  'tests/pm08/replay-scope-contract.mjs',
  'docs/plan-maestro/PM09_EVIDENCIA.md',
  'tests/pm09/la007-results-contract.mjs',
  'tests/pm09/la008-rotation-margin-contract.mjs',
  'tests/pm09/p16-isolation-context-contract.mjs',
  'tests/pm09/p17-robustness-contract.mjs',
  'docs/plan-maestro/PM10_EVIDENCIA.md',
  'tests/pm10/p04-productos-contract.mjs',
  'tests/pm10/p05-pedidos-contract.mjs',
  'tests/pm10/p06-recepcion-contract.mjs',
  'tests/pm10/p07-personal-contract.mjs',
  'tests/pm10/p08-encargos-contract.mjs',
  'tests/pm10/p09-transversal-contract.mjs',
  'tests/pm10/p10-autoridad-persistencia-contract.mjs',
  'tests/pm10/p11-robustez-altas-contract.mjs',
  'tests/pm10/p12-datos-legados-contract.mjs',
  'tests/pm10/p13-contexto-aislamiento-contract.mjs',
  'tests/pm10/P14_REGRESION_INTEGRAL_EVIDENCIA.json',
  'tests/pm10/P15_DEPLOY_PREVIEW_SMOKE_EVIDENCIA.json',
  '.github/workflows/pm10-p16-cierre-final.yml'
];

for (const p of mustExist) {
  assert.equal(fs.existsSync(p), true, `Falta evidencia esperada: ${p}`);
}

const map = fs.readFileSync('tests/g1/P02_MAPA_EVIDENCIAS_F1.md', 'utf8');
const criticalHigh = [
  'LA-001','LA-002','LA-003','LA-004','LA-005','LA-006','LA-007',
  'LA-008','LA-009','LA-010','LA-011','LA-012','LA-013','LA-015','LA-017','LA-018'
];
for (const id of criticalHigh) {
  assert.match(map, new RegExp(`\\| ${id.replace('-', '\\-')} \\|`), `Hallazgo no mapeado: ${id}`);
}
assert.equal(criticalHigh.length, 16);

for (const token of [
  'LA-019',
  'LA-023',
  'Permisos del núcleo',
  'Movimientos y cifras',
  'Concurrencia / reintento',
  'Evidencia por build / SHA exacto',
  'Backend QA separado',
  'Ninguna interacción productiva',
  'G1 NO ESTÁ SUPERADA EN P02'
]) {
  assert.ok(map.includes(token), `Falta criterio G1 en el mapa: ${token}`);
}

// El inventario debe conservar explícitamente la brecha documental de PM06,
// no inventar una evidencia autocontenida que no existe en el árbol actual.
assert.equal(fs.existsSync('docs/plan-maestro/PM06_EVIDENCIA.md'), false, 'Apareció PM06_EVIDENCIA: revisar el mapa antes de cerrar P02');
assert.equal(fs.existsSync('tests/pm06'), false, 'Apareció tests/pm06: revisar el mapa antes de cerrar P02');
assert.match(map, /LA-004 \/ PM06:[\s\S]*brecha de empaquetado de evidencia/i);

const pm02 = fs.readFileSync('docs/plan-maestro/PM02_LA023_EVIDENCIA.txt', 'utf8');
assert.match(pm02, /PM02_LA023_OK=1/);

const pm05 = fs.readFileSync('docs/plan-maestro/PM05_EVIDENCIA.md', 'utf8');
assert.match(pm05, /LA-001/);
assert.match(pm05, /LA-002/);
assert.match(pm05, /LA-003/);
assert.match(pm05, /18\/18 PASS/);

const pm07 = fs.readFileSync('docs/plan-maestro/PM07_EVIDENCIA.md', 'utf8');
for (const id of ['LA-005','LA-006','LA-015']) assert.ok(pm07.includes(id));
assert.match(pm07, /no se ha ejecutado un stress real desde dos sesiones cliente simultáneas/i);

const pm08 = fs.readFileSync('docs/plan-maestro/PM08_EVIDENCIA.md', 'utf8');
assert.match(pm08, /devolución de cliente indivisible/i);
assert.match(pm08, /83\/83/);

const pm09 = fs.readFileSync('docs/plan-maestro/PM09_EVIDENCIA.md', 'utf8');
assert.match(pm09, /LA-007: VALIDADO/);
assert.match(pm09, /LA-008: VALIDADO/);
assert.match(pm09, /no se declara un rebuild fuente→bundle PM09/i);

const pm10 = fs.readFileSync('docs/plan-maestro/PM10_EVIDENCIA.md', 'utf8');
for (const id of ['LA-011','LA-012','LA-013','LA-017','LA-018']) assert.ok(pm10.includes(id));
assert.match(pm10, /Siguiente paquete: \*\*G1 — Núcleo seguro\*\*/);

console.log('G1 P02: mapa de evidencias F1 verificable OK');
