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
assert.match(cuerpo, /function|const ordenarEncargosPendientesPM14/,
  'falta el comparador de fecha de entrega');
assert.match(src, /filter\(esEncargoPendientePM14\)\.sort\(ordenarEncargosPendientesPM14\)/,
  'la lista del local activo no ordena por fecha');
assert.match(src, /sort\(ordenarEncargosPendientesPM14\)/,
  'la lista general no ordena por fecha');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${cuerpo}\nthis.esEncargoPendientePM14 = esEncargoPendientePM14;\nthis.ordenarEncargosPendientesPM14 = ordenarEncargosPendientesPM14;`, ctx);
const pendiente = ctx.esEncargoPendientePM14;
const ordenar = ctx.ordenarEncargosPendientesPM14;
assert.equal(pendiente({ estado: 'Pendiente' }), true);
assert.equal(pendiente({ estado: 'Entregado' }), false);
assert.equal(pendiente({ estado: 'Cancelado' }), false);
assert.equal(pendiente({ estado: 'Devuelto' }), false);
assert.equal(pendiente({ estado: '' }), true, 'un estado legado vacío no debe romper la lista');
assert.ok(ordenar({ id: 'tarde', fechaEntrega: '2026-10-03' }, { id: 'pronto', fechaEntrega: '2026-10-02' }) > 0);
assert.ok(ordenar({ id: 'sin-fecha' }, { id: 'con-fecha', fechaEntrega: '2026-10-02' }) > 0);
assert.ok(ordenar({ id: 'hora-tarde', fechaEntrega: '2026-10-02', horaEntrega: '12:00' }, { id: 'hora-pronto', fechaEntrega: '2026-10-02', horaEntrega: '09:00' }) > 0);

console.log('AUD006_PREDICADO_COMUN_ESTADOS=PASS');
console.log('AUD-006 — pendientes por local y generales: contrato OK');
