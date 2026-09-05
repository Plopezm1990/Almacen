import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');
const p04Ini = src.indexOf('function errorValidacionPM10');
const p04Fin = src.indexOf('function crearLogicaProductos', p04Ini);
const helperIni = src.indexOf('function validarEmpleadoPM10(');
const logicIni = src.indexOf('function crearLogicaPersonal({', helperIni);
const logicFin = src.indexOf('function crearLogicaTurnos({', logicIni);
assert.ok(p04Ini >= 0 && p04Fin > p04Ini, 'helpers PM10 disponibles');
assert.ok(helperIni >= 0 && logicIni > helperIni && logicFin > logicIni, 'lógica LA-017 disponible');

const ctx = { uid: (() => { let n = 0; return () => `emp-${++n}`; })() };
vm.createContext(ctx);
vm.runInContext(src.slice(p04Ini, p04Fin), ctx);
vm.runInContext(src.slice(helperIni, logicFin), ctx);

const validar = ctx.validarEmpleadoPM10;
const crearLogica = ctx.crearLogicaPersonal;
assert.equal(typeof validar, 'function');
assert.equal(typeof crearLogica, 'function');

const base = {
  nombre: 'Empleado QA',
  localId: 'L1',
  horasSemanales: 40,
  pagas: 14,
  salarioBrutoMensual: 1500,
  costeEmpresaMensual: 2100,
  diasVacacionesAnuales: 30
};

function fallo(data, codigo, campo, extra = {}) {
  const r = validar(data, { localActivoId: 'L1', ...extra });
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.codigo, codigo, JSON.stringify(r));
  assert.equal(r.campo, campo, JSON.stringify(r));
  return r;
}

let r = validar(base, { localActivoId: 'L1' });
assert.equal(r.ok, true, JSON.stringify(r));
assert.equal(r.datos.horasSemanales, 40);
assert.equal(r.datos.pagas, 14);
assert.equal(r.datos.salarioBrutoMensual, 1500);
assert.equal(r.datos.costeEmpresaMensual, 2100);
assert.equal(r.datos.diasVacacionesAnuales, 30);

// Horas imposibles.
fallo({ ...base, horasSemanales: -1 }, 'valor_fuera_rango', 'horasSemanales');
fallo({ ...base, horasSemanales: 'abc' }, 'numero_no_finito', 'horasSemanales');
fallo({ ...base, horasSemanales: Infinity }, 'numero_no_finito', 'horasSemanales');
r = validar({ ...base, horasSemanales: 0 }, { localActivoId: 'L1' });
assert.equal(r.ok, true);
r = validar({ ...base, horasSemanales: 37.5 }, { localActivoId: 'L1' });
assert.equal(r.ok, true);

// Pagas: no puede existir un número nulo/negativo o no numérico; no imponemos máximos arbitrarios.
fallo({ ...base, pagas: 0 }, 'valor_fuera_rango', 'pagas');
fallo({ ...base, pagas: -2 }, 'valor_fuera_rango', 'pagas');
fallo({ ...base, pagas: 'abc' }, 'numero_no_finito', 'pagas');
fallo({ ...base, pagas: Infinity }, 'numero_no_finito', 'pagas');
r = validar({ ...base, pagas: '' }, { localActivoId: 'L1' });
assert.equal(r.ok, true);
assert.equal(r.datos.pagas, 14, 'vacío conserva el valor por defecto histórico');

// Salarios/coste empresa no pueden ser negativos ni no finitos; cero sí es un dato válido.
for (const campo of ['salarioBrutoMensual', 'costeEmpresaMensual']) {
  fallo({ ...base, [campo]: -0.01 }, 'valor_fuera_rango', campo);
  fallo({ ...base, [campo]: 'abc' }, 'numero_no_finito', campo);
  fallo({ ...base, [campo]: Infinity }, 'numero_no_finito', campo);
  r = validar({ ...base, [campo]: 0 }, { localActivoId: 'L1' });
  assert.equal(r.ok, true, campo);
}
r = validar({ ...base, costeEmpresaMensual: '' }, { localActivoId: 'L1' });
assert.equal(r.ok, true);
assert.equal(r.datos.costeEmpresaMensual, '', 'coste empresa opcional puede seguir vacío');

// Vacaciones anuales no negativas y finitas.
fallo({ ...base, diasVacacionesAnuales: -1 }, 'valor_fuera_rango', 'diasVacacionesAnuales');
fallo({ ...base, diasVacacionesAnuales: 'abc' }, 'numero_no_finito', 'diasVacacionesAnuales');
fallo({ ...base, diasVacacionesAnuales: Infinity }, 'numero_no_finito', 'diasVacacionesAnuales');
r = validar({ ...base, diasVacacionesAnuales: 0 }, { localActivoId: 'L1' });
assert.equal(r.ok, true);
r = validar({ ...base, diasVacacionesAnuales: 22.5 }, { localActivoId: 'L1' });
assert.equal(r.ok, true);

// Contexto local obligatorio y sin cruce de local.
fallo({ ...base }, 'contexto_no_autorizado', 'localId', { localActivoId: null });
fallo({ ...base, localId: 'L2' }, 'referencia_otro_contexto', 'localId');

function harness(iniciales, localActivoId = 'L1') {
  let estado = structuredClone(iniciales);
  let mutaciones = 0;
  const setEmpleados = (fn) => { mutaciones += 1; estado = fn(estado); };
  const logica = crearLogica({
    empleados: iniciales,
    setEmpleados,
    registrarAuditoria: () => {},
    setNominas: () => {},
    localActivoId
  });
  return { logica, estado: () => estado, mutaciones: () => mutaciones };
}

// Alta: una ficha inválida no muta; la válida posterior sí y normaliza números.
let h = harness([]);
let res = h.logica.addEmpleado({ ...base, horasSemanales: '-5' });
assert.equal(res.ok, false);
assert.equal(h.mutaciones(), 0);
res = h.logica.addEmpleado({ ...base, horasSemanales: '37.5', salarioBrutoMensual: '1600.25', diasVacacionesAnuales: '30' });
assert.ok(res.id, JSON.stringify(res));
assert.equal(h.mutaciones(), 1);
assert.equal(h.estado()[0].horasSemanales, 37.5);
assert.equal(h.estado()[0].salarioBrutoMensual, 1600.25);
assert.equal(h.estado()[0].diasVacacionesAnuales, 30);
assert.equal(h.estado()[0].localId, 'L1');

// Todo o nada: un solo campo malo invalida la ficha completa.
h = harness([]);
res = h.logica.addEmpleado({ ...base, horasSemanales: 40, salarioBrutoMensual: 1500, diasVacacionesAnuales: -1 });
assert.equal(res.ok, false);
assert.equal(h.mutaciones(), 0);

// Edición: inválida no muta; válida posterior funciona.
const existente = { id: 'e1', activo: true, documentos: [], ...base };
h = harness([existente]);
res = h.logica.updateEmpleado('e1', { salarioBrutoMensual: -100 });
assert.equal(res.ok, false);
assert.equal(h.mutaciones(), 0);
assert.equal(h.estado()[0].salarioBrutoMensual, 1500);
res = h.logica.updateEmpleado('e1', { salarioBrutoMensual: '1700.5', horasSemanales: '35' });
assert.equal(res, true);
assert.equal(h.mutaciones(), 1);
assert.equal(h.estado()[0].salarioBrutoMensual, 1700.5);
assert.equal(h.estado()[0].horasSemanales, 35);

// Otro local no puede editarse y no hay mutación sin contexto.
const otro = { id: 'e2', activo: true, documentos: [], ...base, localId: 'L2' };
h = harness([otro]);
res = h.logica.updateEmpleado('e2', { horasSemanales: 20 });
assert.equal(res.ok, false);
assert.equal(h.mutaciones(), 0);
h = harness([existente], null);
res = h.logica.updateEmpleado('e1', { horasSemanales: 20 });
assert.equal(res.ok, false);
assert.equal(h.mutaciones(), 0);

// Un registro legado inválido no se reescribe por el mero hecho de cargar la lógica.
const legado = { id: 'legacy', localId: 'L1', nombre: 'Legado', horasSemanales: -8, pagas: 14, salarioBrutoMensual: 1000, costeEmpresaMensual: '', diasVacacionesAnuales: 30 };
h = harness([legado]);
assert.equal(h.mutaciones(), 0);
assert.equal(h.estado()[0].horasSemanales, -8);
res = h.logica.updateEmpleado('legacy', { puesto: 'Corregir después' });
assert.equal(res.ok, false, 'editar una ficha legado inválida obliga a corregirla, no la normaliza silenciosamente');
assert.equal(h.mutaciones(), 0);

// Evidencia estática: la UI ya no degrada abc/negativos con Number(...)||0/14 y solo cierra tras éxito.
const personalIni = src.indexOf('function Personal({');
const personalFin = src.indexOf('function Turnos({', personalIni);
const ui = src.slice(personalIni, personalFin);
assert.match(ui, /const datos = \{ \.\.\.form \};/);
assert.doesNotMatch(ui, /horasSemanales: Number\(form\.horasSemanales\) \|\| 0/);
assert.doesNotMatch(ui, /pagas: Number\(form\.pagas\) \|\| 14/);
assert.doesNotMatch(ui, /salarioBrutoMensual: Number\(form\.salarioBrutoMensual\) \|\| 0/);
assert.match(ui, /const resultado = editingId \? updateEmpleado\(editingId, datos\) : addEmpleado\(datos\);/);
const resultPos = ui.indexOf('const resultado = editingId ?');
const errorPos = ui.indexOf('resultado.ok === false', resultPos);
const closePos = ui.indexOf('setShowForm(false)', resultPos);
assert.ok(resultPos >= 0 && errorPos > resultPos && closePos > errorPos, 'UI conserva formulario al fallar');

const logic = src.slice(logicIni, logicFin);
assert.match(logic, /function addEmpleado\(data\)[\s\S]{0,300}validarEmpleadoPM10/);
assert.match(logic, /function updateEmpleado\(id, data\)[\s\S]{0,600}validarEmpleadoPM10/);

console.log('PM10 P07 LA-017 Personal: contrato OK');
