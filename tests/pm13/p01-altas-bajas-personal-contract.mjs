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
assert.ok(helperIni >= 0 && logicIni > helperIni && logicFin > logicIni, 'lógica Personal disponible');

const ctx = {
  uid: (() => { let n = 0; return () => `emp-${++n}`; })(),
  todayISO: () => '2026-09-07',
  console
};
vm.createContext(ctx);
vm.runInContext(src.slice(p04Ini, p04Fin), ctx);
vm.runInContext(src.slice(helperIni, logicFin), ctx);

const crearLogica = ctx.crearLogicaPersonal;
assert.equal(typeof crearLogica, 'function');

const base = {
  id: 'e1',
  nombre: 'Empleado QA',
  localId: 'L1',
  activo: true,
  fechaAlta: '2026-01-15',
  fechaBaja: '',
  motivoBaja: '',
  puesto: 'Camarero/a',
  rol: 'Estándar',
  tipoContrato: 'Indefinido',
  horasSemanales: 40,
  pagas: 14,
  salarioBrutoMensual: 1500,
  costeEmpresaMensual: 2100,
  diasVacacionesAnuales: 30,
  documentos: [{ id: 'doc-1', nombre: 'Contrato' }],
  ausencias: [{ id: 'aus-1', tipo: 'Vacaciones' }]
};

function harness(iniciales, { localActivoId = 'L1', nominasIniciales = [{ id: 'n1', empleadoId: 'e1', total: 1500 }] } = {}) {
  let estado = structuredClone(iniciales);
  let nominas = structuredClone(nominasIniciales);
  let mutaciones = 0;
  let mutacionesNomina = 0;
  const auditoria = [];
  const setEmpleados = (fn) => { mutaciones += 1; estado = fn(estado); };
  const setNominas = (fn) => { mutacionesNomina += 1; nominas = fn(nominas); };
  const logica = crearLogica({
    empleados: iniciales,
    setEmpleados,
    registrarAuditoria: (accion, detalle) => auditoria.push({ accion, detalle }),
    setNominas,
    localActivoId,
    locales: [
      { id: 'L1', empresaId: 'E1' },
      { id: 'L2', empresaId: 'E2' }
    ],
    empresaId: localActivoId === 'L1' ? 'E1' : localActivoId === 'L2' ? 'E2' : null
  });
  return {
    logica,
    estado: () => estado,
    nominas: () => nominas,
    mutaciones: () => mutaciones,
    mutacionesNomina: () => mutacionesNomina,
    auditoria
  };
}

// Alta: nace activa, ligada al local activo y sin residuos de una baja previa.
let h = harness([]);
let alta = h.logica.addEmpleado({ ...base, id: undefined, activo: false, fechaAlta: '', fechaBaja: '2025-01-01', motivoBaja: 'dato arrastrado' });
assert.ok(alta.id, JSON.stringify(alta));
assert.equal(alta.localId, 'L1');
assert.equal(alta.activo, true);
assert.equal(alta.fechaAlta, '2026-09-07');
assert.equal(alta.fechaBaja, '');
assert.equal(alta.motivoBaja, '');
assert.equal(h.estado().length, 1);

// Baja normal: conserva la ficha, documentos, ausencias y nóminas; solo cambia estado + trazabilidad.
h = harness([base]);
let ok = h.logica.deleteEmpleado('e1', { fechaBaja: '2026-09-06', motivoBaja: 'Fin de contrato' });
assert.equal(ok, true);
assert.equal(h.estado().length, 1, 'la baja no elimina la ficha');
assert.equal(h.estado()[0].id, 'e1');
assert.equal(h.estado()[0].activo, false);
assert.equal(h.estado()[0].fechaBaja, '2026-09-06');
assert.equal(h.estado()[0].motivoBaja, 'Fin de contrato');
assert.deepEqual(h.estado()[0].documentos, base.documentos);
assert.deepEqual(h.estado()[0].ausencias, base.ausencias);
assert.deepEqual(h.nominas(), [{ id: 'n1', empleadoId: 'e1', total: 1500 }]);
assert.equal(h.mutacionesNomina(), 0, 'la baja no toca nóminas');
assert.equal(h.auditoria.length, 1);
assert.equal(h.auditoria[0].accion, 'Dar de baja empleado');
assert.match(h.auditoria[0].detalle, /Fin de contrato/);

// Replay/doble clic: la segunda baja es idempotente, sin segunda mutación ni auditoría.
ok = h.logica.deleteEmpleado('e1', { fechaBaja: '2026-09-07', motivoBaja: 'doble clic' });
assert.equal(ok, true);
assert.equal(h.mutaciones(), 1);
assert.equal(h.auditoria.length, 1);
assert.equal(h.estado()[0].fechaBaja, '2026-09-06', 'el replay no reescribe la primera baja');

// Registro ya inactivo/legado: no se reescribe silenciosamente.
const legadoBaja = { ...base, activo: false, fechaBaja: '', motivoBaja: '' };
h = harness([legadoBaja]);
ok = h.logica.deleteEmpleado('e1');
assert.equal(ok, true);
assert.equal(h.mutaciones(), 0);
assert.equal(h.auditoria.length, 0);
assert.equal(h.estado()[0].fechaBaja, '');

// Aislamiento: otro local o ausencia de contexto nunca pueden dar de baja.
h = harness([{ ...base, id: 'e2', localId: 'L2' }]);
ok = h.logica.deleteEmpleado('e2', { motivoBaja: 'No autorizado' });
assert.equal(ok, false);
assert.equal(h.mutaciones(), 0);
h = harness([base], { localActivoId: null });
ok = h.logica.deleteEmpleado('e1');
assert.equal(ok, false);
assert.equal(h.mutaciones(), 0);

// Compatibilidad con edición histórica: desactivar registra baja; reactivar limpia la baja.
h = harness([base]);
ok = h.logica.updateEmpleado('e1', { activo: false });
assert.equal(ok, true);
assert.equal(h.estado()[0].activo, false);
assert.equal(h.estado()[0].fechaBaja, '2026-09-07');
assert.equal(h.estado()[0].motivoBaja, 'Baja registrada desde edición');
assert.equal(h.auditoria[0].accion, 'Dar de baja empleado');

h = harness([{ ...base, activo: false, fechaBaja: '2026-08-30', motivoBaja: 'Temporal' }]);
ok = h.logica.updateEmpleado('e1', { activo: true });
assert.equal(ok, true);
assert.equal(h.estado()[0].activo, true);
assert.equal(h.estado()[0].fechaBaja, '');
assert.equal(h.estado()[0].motivoBaja, '');
assert.equal(h.auditoria[0].accion, 'Reactivar empleado');

// Evidencia estática: no queda borrado físico de empleados/nóminas dentro de Personal.
const logic = src.slice(logicIni, logicFin);
assert.doesNotMatch(logic, /setEmpleados\([\s\S]{0,140}\.filter\([\s\S]{0,100}\.id !== id/);
assert.doesNotMatch(logic, /setNominas[\s\S]{0,180}\.filter\([\s\S]{0,120}empleadoId !== id/);
assert.match(logic, /const bajasRegistradasPersonalPM13 = new Set/);
assert.match(logic, /function deleteEmpleado\(id, baja = \{\}\)/);
assert.match(logic, /activo: false, fechaBaja, motivoBaja/);

// UI: la acción normal ya no promete borrado destructivo y muestra la baja histórica.
const personalIni = src.indexOf('function Personal({');
const personalFin = src.indexOf('function Turnos({', personalIni);
const ui = src.slice(personalIni, personalFin);
assert.match(ui, /Dar de baja empleado/);
assert.match(ui, /Dar de baja/);
assert.doesNotMatch(ui, /Eliminar del todo/);
assert.doesNotMatch(ui, /Se borra la ficha completa/);
assert.match(ui, /e2\.fechaBaja \|\| \"sin fecha \(registro legado\)\"/);
assert.match(ui, /La baja desactiva al empleado sin borrar su ficha/);

console.log('PM13 P01 altas/bajas personal: contrato OK');
