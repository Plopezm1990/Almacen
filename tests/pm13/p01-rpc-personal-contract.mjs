import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');
const helpersIni = src.indexOf('function errorValidacionPM10');
const helpersFin = src.indexOf('function crearLogicaProductos', helpersIni);
const validarIni = src.indexOf('function validarEmpleadoPM10(');
const logicIni = src.indexOf('function crearLogicaPersonal({', validarIni);
const logicFin = src.indexOf('function crearLogicaTurnos({', logicIni);
assert.ok(helpersIni >= 0 && helpersFin > helpersIni && validarIni >= 0 && logicIni > validarIni && logicFin > logicIni);

const ctx = {
  uid: (() => { let n = 0; return () => `id-${++n}`; })(),
  todayISO: () => '2026-09-07',
  console
};
vm.createContext(ctx);
vm.runInContext(src.slice(helpersIni, helpersFin), ctx);
vm.runInContext(src.slice(validarIni, logicFin), ctx);
const crearLogica = ctx.crearLogicaPersonal;

const base = {
  id: 'e1', nombre: 'Empleado QA', localId: 'L1', activo: true,
  fechaAlta: '2026-01-01', fechaBaja: '', motivoBaja: '',
  puesto: 'Camarero/a', rol: 'Estándar', tipoContrato: 'Indefinido',
  horasSemanales: 40, pagas: 14, salarioBrutoMensual: 1500,
  costeEmpresaMensual: 2100, diasVacacionesAnuales: 30,
  documentos: [{ id: 'd1', nombre: 'Contrato' }], ausencias: [{ id: 'a1', tipo: 'Vacaciones' }]
};

function harness(iniciales = [base]) {
  let estado = structuredClone(iniciales);
  let nominas = [{ id: 'n1', empleadoId: 'e1' }];
  let mut = 0;
  let mutNom = 0;
  const auditoria = [];
  return {
    logica: crearLogica({
      empleados: iniciales,
      setEmpleados: (fn) => { mut++; estado = fn(estado); },
      setNominas: (fn) => { mutNom++; nominas = fn(nominas); },
      registrarAuditoria: (accion, detalle) => auditoria.push({ accion, detalle }),
      localActivoId: 'L1',
      locales: [{ id: 'L1', empresaId: 'E1' }],
      empresaId: 'E1'
    }),
    estado: () => estado,
    nominas: () => nominas,
    mut: () => mut,
    mutNom: () => mutNom,
    auditoria
  };
}

// Sin navegador/Supabase, la API histórica sigue siendo síncrona.
delete ctx.window;
let h = harness([]);
const syncAlta = h.logica.addEmpleado({ ...base, id: undefined, fechaAlta: '' });
assert.equal(typeof syncAlta?.then, 'undefined', 'fallback de alta sigue síncrono');
assert.equal(h.estado().length, 1);

h = harness();
const syncBaja = h.logica.deleteEmpleado('e1', { motivoBaja: 'Fallback' });
assert.equal(typeof syncBaja?.then, 'undefined', 'fallback de baja sigue síncrono');
assert.equal(syncBaja, true);
assert.equal(h.estado()[0].activo, false);
assert.equal(h.nominas().length, 1);
assert.equal(h.mutNom(), 0);

// En navegador, backend autoritativo: error remoto => cero cambio local.
const fallos = [];
ctx.window = { getSupabaseClient: async () => ({ rpc: async (nombre, args) => {
  fallos.push({ nombre, args });
  return { data: null, error: { message: 'fallo remoto controlado' } };
} }) };
h = harness();
let r = await h.logica.deleteEmpleado('e1', { motivoBaja: 'Remota' });
assert.equal(r.ok, false);
assert.match(r.error, /fallo remoto controlado/);
assert.equal(h.mut(), 0);
assert.equal(h.estado()[0].activo, true);
assert.equal(fallos[0].nombre, 'pm11_baja_empleado');

// Baja confirmada: RPC con scope exacto, después cambia caché, nunca nómina/auditoría local.
const bajas = [];
ctx.window = { getSupabaseClient: async () => ({ rpc: async (nombre, args) => {
  bajas.push({ nombre, args });
  return { data: { empleado: { datos: { fechaBaja: '2026-09-07', motivoBaja: args.p_motivo } } }, error: null };
} }) };
h = harness();
r = await h.logica.deleteEmpleado('e1', { motivoBaja: 'Fin remoto' });
assert.equal(r, true);
assert.equal(bajas.length, 1);
assert.equal(bajas[0].nombre, 'pm11_baja_empleado');
assert.equal(bajas[0].args.p_empresa_id, 'E1');
assert.equal(bajas[0].args.p_local_id, 'L1');
assert.equal(bajas[0].args.p_empleado_id, 'e1');
assert.equal(bajas[0].args.p_motivo, 'Fin remoto');
assert.equal(h.estado()[0].activo, false);
assert.equal(h.estado()[0].fechaBaja, '2026-09-07');
assert.equal(h.mutNom(), 0);
assert.equal(h.auditoria.length, 0);

// Doble clic concurrente de alta: una RPC cliente y una ficha local.
let rpcAlta = 0;
ctx.window = { getSupabaseClient: async () => ({ rpc: async (nombre, args) => {
  assert.equal(nombre, 'pm11_alta_empleado');
  rpcAlta++;
  await new Promise((resolve) => setTimeout(resolve, 15));
  return { data: { ok: true, empleado: { datos: args.p_datos } }, error: null };
} }) };
h = harness([]);
const control = { empleadoId: 'e-estable', operationId: 'op-estable' };
const [a1, a2] = await Promise.all([
  h.logica.addEmpleado({ ...base, id: undefined, nombre: 'Alta remota' }, control),
  h.logica.addEmpleado({ ...base, id: undefined, nombre: 'Alta remota' }, control)
]);
assert.equal(rpcAlta, 1);
assert.equal(a1.id, 'e-estable');
assert.equal(a2.id, 'e-estable');
assert.equal(h.estado().length, 1);
assert.equal(h.estado()[0].pm13AltaOperationId, 'op-estable');

// Edición y reactivación usan RPC PM11 dedicadas.
let ultima;
ctx.window = { getSupabaseClient: async () => ({ rpc: async (nombre, args) => {
  ultima = { nombre, args };
  return { data: { ok: true }, error: null };
} }) };
h = harness();
r = await h.logica.updateEmpleado('e1', { puesto: 'Encargado/a' });
assert.equal(r, true);
assert.equal(ultima.nombre, 'pm11_editar_empleado');
assert.equal(h.estado()[0].puesto, 'Encargado/a');

h = harness([{ ...base, activo: false, fechaBaja: '2026-09-01', motivoBaja: 'Temporal' }]);
r = await h.logica.reactivarEmpleado('e1');
assert.equal(r, true);
assert.equal(ultima.nombre, 'pm11_reactivar_empleado');
assert.equal(h.estado()[0].activo, true);
assert.equal(h.estado()[0].fechaBaja, '');

delete ctx.window;

const logic = src.slice(logicIni, logicFin);
for (const rpc of ['pm11_alta_empleado', 'pm11_editar_empleado', 'pm11_baja_empleado', 'pm11_reactivar_empleado']) assert.ok(logic.includes(rpc));
assert.match(logic, /async function ejecutarRpcPersonalPM13/);
assert.match(logic, /function addEmpleado\(data, controlPM13 = \{\}\)/);
assert.match(logic, /function deleteEmpleado\(id, baja = \{\}\)/);
assert.match(logic, /function reactivarEmpleado\(id\)/);
assert.doesNotMatch(logic, /setEmpleados\([\s\S]{0,140}\.filter\([\s\S]{0,100}\.id !== id/);
assert.doesNotMatch(logic, /setNominas[\s\S]{0,180}\.filter\([\s\S]{0,120}empleadoId !== id/);

const uiIni = src.indexOf('function Personal({');
const uiFin = src.indexOf('function Turnos({', uiIni);
const ui = src.slice(uiIni, uiFin);
assert.match(ui, /await addEmpleado\(datos, controlAltaPersonalPM13\)/);
assert.match(ui, /await updateEmpleado\(editingId, datos\)/);
assert.match(ui, /await deleteEmpleado\(confirmDeleteId\)/);
assert.match(ui, /await reactivarEmpleado\(e2\.id\)/);
assert.doesNotMatch(ui, /Eliminar del todo|Se borra la ficha completa/);
assert.doesNotMatch(ui, /anonimizarEmpleado\(confirmDeleteId\)/);

console.log('PM13 P01 RPC híbrido: contrato OK');
