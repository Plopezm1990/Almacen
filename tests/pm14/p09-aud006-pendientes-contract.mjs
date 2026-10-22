import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// AUD-006: la lista del local activo y la lista general deben aplicar la misma
// regla. Cancelados y devueltos solo pertenecen al historial.
const src = fs.readFileSync('fuente.js', 'utf8');
const ini = src.indexOf('const esEncargoPendientePM14 =');
assert.ok(ini >= 0, 'falta el predicado común de encargos pendientes');
const fin = src.indexOf('const encargosPendientesDelLocalActivo', ini);
assert.ok(fin > ini, 'no se pudo acotar el predicado común');
const cuerpo = src.slice(ini, fin);
assert.match(cuerpo, /estado !== "Entregado"/);
assert.match(cuerpo, /estado !== "Cancelado"/);
assert.match(cuerpo, /estado !== "Devuelto"/);
assert.match(src, /encargosDelLocalActivo\.filter\(esEncargoPendientePM14\)/,
  'la lista del local activo no usa el predicado común');
assert.match(src, /encargos\.filter\(esEncargoPendientePM14\)/,
  'la lista general no usa el predicado común');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${cuerpo}\nthis.esEncargoPendientePM14 = esEncargoPendientePM14;`, ctx);
const pendiente = ctx.esEncargoPendientePM14;
assert.equal(pendiente({ estado: 'Pendiente' }), true);
assert.equal(pendiente({ estado: 'Entregado' }), false);
assert.equal(pendiente({ estado: 'Cancelado' }), false);
assert.equal(pendiente({ estado: 'Devuelto' }), false);
assert.equal(pendiente({ estado: '' }), true, 'un estado legado vacío no debe romper la lista');

console.log('AUD006_PREDICADO_COMUN_ESTADOS=PASS');
console.log('AUD-006 — pendientes por local y generales: contrato OK');
