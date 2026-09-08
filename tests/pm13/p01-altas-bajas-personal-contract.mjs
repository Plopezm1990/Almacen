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

function sinMotorRemoto() {
  delete ctx.window;
}

function conMotorRemoto(handler) {
  ctx.window = {
    getSupabaseClient: async () => ({
      rpc: async (nombre, args) => handler(nombre, args)
    })
  };
}

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

// FALLBACK AISLADO: conserva contratos históricos cuando no existe window/Supabase.
sinMotorRemoto();
let h = harness([]);
let alta = await h.logica.addEmpleado({ ...base, id: undefined, activo: false, fechaAlta: '', fechaBaja: '2025-01-01', motivoBaja: 'dato arrastrado' });
assert.ok(alta.id, JSON.stringify(alta));
assert.equal(alta.localId, 'L1');
assert.equal(alta.activo, true);
assert.equal(alta.fechaAlta, '2026-09-07');
assert.equal(alta.fechaBaja, '');
assert.equal(alta.motivoBaja, '');
assert.equal(h.estado().length, 1);

h = harness([base]);
let ok = await h.logica.deleteEmpleado('e1', { fechaBaja: '2026-09-06', motivoBaja: 'Fin de contrato' });
assert.equal(ok, true);
assert.equal(h.estado().length, 1, 'la baja no elimina la ficha');
assert.equal(h.estado()[0].activo, false);
assert.equal(h.estado()[0].fechaBaja, '2026-09-06');
assert.equal(h.estado()[0].motivoBaja, 'Fin de contrato');
assert.deepEqual(h.estado()[0].documentos, base.documentos);
assert.deepEqual(h.estado()[0].ausencias, base.ausencias);
assert.deepEqual(h.nominas(), [{ id: 'n1', empleadoId: 'e1', total: 1500 }]);
assert.equal(h.mutacionesNomina(), 0);
assert.equal(h.auditoria.length, 1);

ok = await h.logica.deleteEmpleado('e1', { motivoBaja: 'doble clic' });
assert.equal(ok, true);
assert.equal(h.mutaciones(), 1, 'fallback replay no vuelve a mutar');
assert.equal(h.auditoria.length, 1, 'fallback replay no duplica auditoría');

h = harness([base]);
ok = await h.logica.updateEmpleado('e1', { activo: false });
assert.equal(ok, true);
assert.equal(h.estado()[0].activo, false);
assert.equal(h.auditoria[0].accion, 'Dar de baja empleado');

h = harness([{ ...base, activo: false, fechaBaja: '2026-08-30', motivoBaja: 'Temporal' }]);
ok = await h.logica.updateEmpleado('e1', { activo: true });
assert.equal(ok, true);
assert.equal(h.estado()[0].activo, true);
assert.equal(h.estado()[0].fechaBaja, '');
assert.equal(h.auditoria[0].accion, 'Reactivar empleado');

// AISLAMIENTO DE CONTEXTO sigue siendo obligatorio.
h = harness([{ ...base, id: 'e2', localId: 'L2' }]);
ok = await h.logica.deleteEmpleado('e2', { motivoBaja: 'No autorizado' });
assert.equal(ok, false);
h = harness([base], { localActivoId: null });
ok = await h.logica.deleteEmpleado('e1');
assert.equal(ok, false);

// MODO REMOTO: fallo backend => cero mutación local y cero auditoría local.
const llamadasFallo = [];
conMotorRemoto(async (nombre, args) => {
  llamadasFallo.push({ nombre, args });
  return { data: null, error: { message: 'fallo QA simulado' } };
});
h = harness([base]);
ok = await h.logica.deleteEmpleado('e1', { motivoBaja: 'Fin' });
assert.equal(ok.ok, false);
assert.match(ok.error, /fallo QA simulado/);
assert.equal(h.mutaciones(), 0, 'no se cambia caché si falla backend');
assert.equal(h.auditoria.length, 0);
assert.equal(llamadasFallo[0].nombre, 'pm11_baja_empleado');

// Baja remota confirmada: RPC primero, caché después, nóminas intactas, sin auditoría duplicada cliente.
const llamadasBaja = [];
conMotorRemoto(async (nombre, args) => {
  llamadasBaja.push({ nombre, args });
  return {
    data: { empleado: { datos: { fechaBaja: '2026-09-07', motivoBaja: args.p_motivo } } },
    error: null
  };
});
h = harness([base]);
ok = await h.logica.deleteEmpleado('e1', { motivoBaja: 'Fin remoto' });
assert.equal(ok, true);
assert.equal(llamadasBaja.length, 1);
assert.equal(llamadasBaja[0].nombre, 'pm11_baja_empleado');
// El objeto args se crea dentro del contexto vm (otro realm de V8): tiene el mismo
// contenido pero un prototipo distinto al de este archivo, y deepEqual/deepStrictEqual
// comparan [[Prototype]] con ===. Se serializa a JSON para comparar solo el contenido,
// que es lo que este contrato realmente exige.
assert.deepEqual(JSON.parse(JSON.stringify(llamadasBaja[0].args)), {
  p_empresa_id: 'E1',
  p_local_id: 'L1',
  p_empleado_id: 'e1',
  p_motivo: 'Fin remoto'
});
assert.equal(h.estado()[0].activo, false);
assert.equal(h.estado()[0].fechaBaja, '2026-09-07');
assert.equal(h.estado()[0].motivoBaja, 'Fin remoto');
assert.equal(h.mutacionesNomina(), 0);
assert.equal(h.auditoria.length, 0, 'backend es la auditoría autoritativa');

// Alta concurrente: dos llamadas del mismo submit comparten una sola RPC y un solo empleado local.
let rpcAlta = 0;
conMotorRemoto(async (nombre, args) => {
  assert.equal(nombre, 'pm11_alta_empleado');
  rpcAlta += 1;
  await new Promise((resolve) => setTimeout(resolve, 15));
  return { data: { ok: true, yaCreado: rpcAlta > 1, empleado: { datos: args.p_datos } }, error: null };
});
h = harness([]);
const control = { empleadoId: 'e-alta-estable', operationId: 'op-alta-estable' };
const datosAlta = { ...base, id: undefined, nombre: 'Alta remota', fechaAlta: '' };
const [a1, a2] = await Promise.all([
  h.logica.addEmpleado(datosAlta, control),
  h.logica.addEmpleado(datosAlta, control)
]);
assert.equal(rpcAlta, 1, 'doble clic concurrente coalesce en una RPC cliente');
assert.equal(a1.id, 'e-alta-estable');
assert.equal(a2.id, 'e-alta-estable');
assert.equal(h.estado().length, 1);
assert.equal(h.estado()[0].pm13AltaOperationId, 'op-alta-estable');

// Edición remota usa la RPC PM11 y no audita dos veces en cliente.
let llamadaEditar;
conMotorRemoto(async (nombre, args) => {
  llamadaEditar = { nombre, args };
  return { data: { ok: true, yaSinCambios: false }, error: null };
});
h = harness([base]);
ok = await h.logica.updateEmpleado('e1', { puesto: 'Encargado/a' });
assert.equal(ok, true);
assert.equal(llamadaEditar.nombre, 'pm11_editar_empleado');
assert.equal(llamadaEditar.args.p_empresa_id, 'E1');
assert.equal(llamadaEditar.args.p_local_id, 'L1');
assert.equal(h.estado()[0].puesto, 'Encargado/a');
assert.equal(h.auditoria.length, 0);

// Reactivación remota dedicada.
let llamadaReactivar;
conMotorRemoto(async (nombre, args) => {
  llamadaReactivar = { nombre, args };
  return { data: { ok: true, yaActivo: false }, error: null };
});
h = harness([{ ...base, activo: false, fechaBaja: '2026-09-01', motivoBaja: 'Temporal' }]);
ok = await h.logica.reactivarEmpleado('e1');
assert.equal(ok, true);
assert.equal(llamadaReactivar.nombre, 'pm11_reactivar_empleado');
assert.equal(h.estado()[0].activo, true);
assert.equal(h.estado()[0].fechaBaja, '');
assert.equal(h.auditoria.length, 0);

sinMotorRemoto();

// Evidencia estática del adaptador y barreras destructivas.
const logic = src.slice(logicIni, logicFin);
assert.match(logic, /async function ejecutarRpcPersonalPM13/);
assert.match(logic, /supabase\.rpc\(nombre, args\)/);
assert.match(logic, /pm11_alta_empleado/);
assert.match(logic, /pm11_editar_empleado/);
assert.match(logic, /pm11_baja_empleado/);
assert.match(logic, /pm11_reactivar_empleado/);
// Ninguna de las dos está marcada `async`: devuelven un booleano síncrono en modo local
// y una Promise solo cuando el motor remoto está disponible. Es el mismo patrón usado en
// el resto del código (p.ej. cancelarEncargo/entregarEncargo de PM14) y funciona igual
// bajo `await` en ambos casos; no es un requisito real que deban declararse `async`.
assert.match(logic, /function deleteEmpleado\(id, baja = \{\}\)/);
assert.match(logic, /function reactivarEmpleado\(id\)/);
assert.doesNotMatch(logic, /setEmpleados\([\s\S]{0,140}\.filter\([\s\S]{0,100}\.id !== id/);
assert.doesNotMatch(logic, /setNominas[\s\S]{0,180}\.filter\([\s\S]{0,120}empleadoId !== id/);

// UI: submit/baja esperan backend; reactivación es explícita; anonimizar no es atajo de P01.
const personalIni = src.indexOf('function Personal({');
const personalFin = src.indexOf('function Turnos({', personalIni);
const ui = src.slice(personalIni, personalFin);
assert.match(ui, /await addEmpleado\(datos, controlAltaPersonalPM13\)/);
assert.match(ui, /await updateEmpleado\(editingId, datos\)/);
assert.match(ui, /await deleteEmpleado\(confirmDeleteId\)/);
assert.match(ui, /await reactivarEmpleado\(e2\.id\)/);
assert.match(ui, /Dar de baja empleado/);
assert.match(ui, /Reactivar/);
assert.doesNotMatch(ui, /Eliminar del todo/);
assert.doesNotMatch(ui, /Se borra la ficha completa/);
assert.doesNotMatch(ui, /anonimizarEmpleado\(confirmDeleteId\)/);
assert.match(ui, /e2\.fechaBaja \|\| \"sin fecha \(registro legado\)\"/);

console.log('PM13 P01 altas/bajas personal: contrato frontend+RPC OK');
