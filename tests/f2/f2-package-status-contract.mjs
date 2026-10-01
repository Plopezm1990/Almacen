import fs from 'node:fs';
import assert from 'node:assert/strict';

const status = fs.readFileSync('docs/plan-abc/F2_7_ESTADO_PAQUETE_PREPARACION_2026-10-01.md', 'utf8');

for (const term of ['F2.1 contrato transaccional', 'F2.2 dependencias de release', 'F2.3 verificación local', 'F2.4 precheck de migración', 'F2.5 puerta de revisión', 'F2.6 manifiesto/recuperación']) {
  assert.match(status, new RegExp(term, 'i'), `F2.7 falta ${term}`);
}
assert.match(status, /PREPARADO_BLOQUEADO_POR_HERRAMIENTA_LOCAL/);
assert.match(status, /PGlite pasa la regresión auxiliar/i);
assert.match(status, /No se ejecutó SQL remoto/i);
assert.match(status, /no impide conservar este estado de F2/i);
assert.match(status, /no cerrado para aplicación/i);

console.log('ABC_F2_PACKAGE_STATUS=PASS_WITH_BLOCK');
