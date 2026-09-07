import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');
const logicIni = src.indexOf('function crearLogicaPersonal({');
const logicFin = src.indexOf('function crearLogicaTurnos({', logicIni);
assert.ok(logicIni >= 0 && logicFin > logicIni, 'crearLogicaPersonal disponible');
const logicSrc = src.slice(logicIni, logicFin);

assert.match(logicSrc, /function validarAusenciaPM13\(/);
assert.match(logicSrc, /empleadoLocal\.activo === false/);
assert.match(logicSrc, /fechaISOValidaAusenciaPM13/);
assert.match(logicSrc, /ausencia_solapada/);
assert.match(logicSrc, /pm13_registrar_ausencia/);
assert.match(logicSrc, /pm13_anular_ausencia/);
assert.match(logicSrc, /ejecutarUnaVezPersonalPM13\(`ausencia:/);
assert.match(logicSrc, /estado: "ANULADA"/);
assert.doesNotMatch(logicSrc, /ausencias: \(e2\.ausencias \|\| \[\]\)\.filter\(\(a22\) => a22\.id !== ausenciaId\)/);

const ctx = {
  console,
  Date,
  Set,
  Map,
  Promise,
  String,
  Number,
  Math,
  errorValidacionPM10: (codigo, campo, error) => ({ ok: false, codigo, campo, error }),
  uid: (() => { let n = 0; return () => `u-${++n}`; })(),
  todayISO: () => '2026-09-07'
};
vm.createContext(ctx);
vm.runInContext(logicSrc, ctx);
assert.equal(typeof ctx.crearLogicaPersonal, 'function');

function harness(iniciales, localActivoId = 'L1', empresaId = 'E1') {
  let estado = structuredClone(iniciales);
  let mutaciones = 0;
  const crear = () => ctx.crearLogicaPersonal({
    empleados: estado,
    setEmpleados: (fn) => { mutaciones++; estado = fn(estado); },
    registrarAuditoria: () => {},
    setNominas: () => {},
    localActivoId,
    empresaId,
    locales: []
  });
  return { crear, estado: () => estado, mutaciones: () => mutaciones };
}

const emp = { id: 'e1', empresaId: 'E1', localId: 'L1', nombre: 'QA', activo: true, ausencias: [] };
let h = harness([emp]);
let l = h.crear();

let r = l.registrarAusencia('e1', { tipo: 'Inventado', fechaInicio: '2026-09-10', fechaFin: '2026-09-11' });
assert.equal(r.ok, false); assert.equal(r.codigo, 'ausencia_tipo_invalido'); assert.equal(h.mutaciones(), 0);
r = l.registrarAusencia('e1', { tipo: 'Otro', fechaInicio: '2026-02-30', fechaFin: '2026-03-01' });
assert.equal(r.ok, false); assert.equal(r.codigo, 'fecha_invalida'); assert.equal(h.mutaciones(), 0);
r = l.registrarAusencia('e1', { tipo: 'Otro', fechaInicio: '2026-09-12', fechaFin: '2026-09-10' });
assert.equal(r.ok, false); assert.equal(r.codigo, 'rango_fechas_invalido'); assert.equal(h.mutaciones(), 0);

r = l.registrarAusencia('e1', { tipo: 'Baja medica', fechaInicio: '2026-09-10', fechaFin: '2026-09-12' });
assert.equal(r.ok, true, JSON.stringify(r));
assert.equal(h.estado()[0].ausencias.length, 1);
assert.equal(h.estado()[0].ausencias[0].tipo, 'Baja médica');
assert.equal(h.estado()[0].ausencias[0].dias, 3);
assert.equal(h.estado()[0].ausencias[0].estado, 'ACTIVA');

// La misma interacción no puede duplicar: en fallback se rechaza por solape/pending; en remoto se coalesce por operationId.
r = l.registrarAusencia('e1', { tipo: 'Baja medica', fechaInicio: '2026-09-10', fechaFin: '2026-09-12' });
assert.equal(r.ok, false);
assert.equal(h.estado()[0].ausencias.length, 1);

// Un nuevo render ve la ausencia persistida y bloquea cualquier solape.
l = h.crear();
r = l.registrarAusencia('e1', { tipo: 'Otro', fechaInicio: '2026-09-11', fechaFin: '2026-09-13' });
assert.equal(r.ok, false); assert.equal(r.codigo, 'ausencia_solapada');
assert.equal(h.estado()[0].ausencias.length, 1);

// Anular conserva el elemento y su identidad: no hay borrado físico.
const ausenciaId = h.estado()[0].ausencias[0].id;
r = l.eliminarAusencia('e1', ausenciaId);
assert.equal(r.ok, true);
assert.equal(h.estado()[0].ausencias.length, 1);
assert.equal(h.estado()[0].ausencias[0].estado, 'ANULADA');
assert.ok(h.estado()[0].ausencias[0].motivoAnulacion);

// Tras anular, un intervalo antes solapado puede registrarse como una nueva ausencia.
l = h.crear();
r = l.registrarAusencia('e1', { tipo: 'Otro', fechaInicio: '2026-09-11', fechaFin: '2026-09-13' });
assert.equal(r.ok, true, JSON.stringify(r));
assert.equal(h.estado()[0].ausencias.length, 2);

// Empleado inactivo y otro local: fail closed.
h = harness([{ ...emp, activo: false }]);
l = h.crear();
r = l.registrarAusencia('e1', { tipo: 'Otro', fechaInicio: '2026-09-10', fechaFin: '2026-09-10' });
assert.equal(r.ok, false); assert.equal(r.codigo, 'empleado_no_activo');
h = harness([{ ...emp, localId: 'L2' }]);
l = h.crear();
r = l.registrarAusencia('e1', { tipo: 'Otro', fechaInicio: '2026-09-10', fechaFin: '2026-09-10' });
assert.equal(r.ok, false); assert.equal(r.codigo, 'contexto_no_autorizado');

const uiIni = src.indexOf('function Personal({');
const uiFin = src.indexOf('function Turnos({', uiIni);
const ui = src.slice(uiIni, uiFin);
assert.match(ui, /async function submitAusencia\(\)/);
assert.match(ui, /const resultado = await registrarAusencia/);
const resultPos = ui.indexOf('const resultado = await registrarAusencia');
const failPos = ui.indexOf('resultado.ok === false', resultPos);
const closePos = ui.indexOf('setAusenciaFor(null)', resultPos);
assert.ok(resultPos >= 0 && failPos > resultPos && closePos > failPos, 'modal solo cierra tras éxito');
assert.match(ui, /"aria-label": "Anular ausencia"/);
assert.match(ui, /estado \|\| "ACTIVA"/);
assert.match(ui, /ANULADA/);
assert.doesNotMatch(ui, /"aria-label": "Eliminar ausencia"/);

console.log('PM13_P04_AUSENCIAS_FRONTEND=PASS');
console.log('VALIDACION_FECHAS_TIPO_SCOPE=1');
console.log('SOLAPAMIENTOS=1');
console.log('ANULACION_SIN_BORRADO=1');
console.log('UI_FAIL_CLOSED=1');
