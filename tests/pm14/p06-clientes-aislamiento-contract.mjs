import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');
const ini = src.indexOf('function crearLogicaClientes({');
const fin = src.indexOf('function crearMotorStock({', ini);
assert.ok(ini >= 0 && fin > ini, 'bloque crearLogicaClientes presente');

const ctx = {
  todayISO: () => '2026-09-08',
  uid: (() => { let n = 0; return () => `id-${++n}`; })(),
  console,
  setTimeout,
  clearTimeout
};
vm.createContext(ctx);
vm.runInContext(src.slice(ini, fin), ctx);
const crearLogica = ctx.crearLogicaClientes;
assert.equal(typeof crearLogica, 'function');

function harness(iniciales = [], empresaId = 'E1') {
  let estado = structuredClone(iniciales);
  const auditoria = [];
  const setClientes = (fn) => { estado = fn(estado); };
  return {
    logica: crearLogica({ clientes: estado, setClientes, registrarAuditoria: (a, d) => auditoria.push({ a, d }), empresaId }),
    estado: () => estado,
    auditoria
  };
}

// ---- Sin conexión (sin window): las operaciones siguen siendo síncronas y no truenan. ----
delete ctx.window;

// ---- Alta: exige empresa en contexto; sin ella no se crea nada. ----
let h = harness([], null);
let r = h.logica.addCliente({ nombre: 'Ana' });
assert.equal(r.ok, false, JSON.stringify(r));
assert.equal(r.codigo, 'contexto_no_autorizado');
assert.equal(h.estado().length, 0);
console.log('P06_ALTA_SIN_EMPRESA_RECHAZADA=PASS');

h = harness([], 'E1');
r = h.logica.addCliente({ nombre: 'Ana' });
assert.ok(r.id, JSON.stringify(r));
assert.equal(r.empresaId, 'E1');
assert.equal(h.estado().length, 1);
console.log('P06_ALTA_OK=PASS');

// ---- Editar un cliente de OTRA empresa se rechaza (antes no comprobaba nada). ----
h = harness([{ id: 'c1', nombre: 'Ana', empresaId: 'E2' }], 'E1');
r = h.logica.updateCliente('c1', { nombre: 'Ana editada' });
assert.equal(r.ok, false);
assert.equal(r.codigo, 'contexto_no_autorizado');
assert.equal(h.estado()[0].nombre, 'Ana', 'no debe cambiar nada de otra empresa');
console.log('P06_EDITAR_OTRA_EMPRESA_RECHAZADO=PASS');

h = harness([{ id: 'c1', nombre: 'Ana', empresaId: 'E1' }], 'E1');
r = h.logica.updateCliente('c1', { nombre: 'Ana editada' });
assert.equal(r, true);
assert.equal(h.estado()[0].nombre, 'Ana editada');
console.log('P06_EDITAR_MISMA_EMPRESA_OK=PASS');

// ---- Borrar un cliente de otra empresa: rechazado (antes borraba sin comprobar nada). ----
h = harness([{ id: 'c1', nombre: 'Ana', empresaId: 'E2' }], 'E1');
let eliminado = h.logica.deleteCliente('c1');
assert.equal(eliminado, false, 'un cliente de otra empresa no debe poder borrarse');
assert.equal(h.estado().length, 1);
console.log('P06_ELIMINAR_OTRA_EMPRESA_RECHAZADO=PASS');

h = harness([{ id: 'c1', nombre: 'Ana', empresaId: 'E1' }], 'E1');
eliminado = h.logica.deleteCliente('c1');
assert.equal(eliminado, true);
assert.equal(h.estado().length, 0);
assert.ok(h.auditoria.some((x) => x.a === 'Eliminar cliente'));
console.log('P06_ELIMINAR_MISMA_EMPRESA_OK=PASS');

// ---- Cliente inexistente: rechazado sin reventar. ----
h = harness([], 'E1');
eliminado = h.logica.deleteCliente('no-existe');
assert.equal(eliminado, false);
console.log('P06_ELIMINAR_INEXISTENTE_RECHAZADO=PASS');

// ---- Anonimizar: exige misma empresa (antes no comprobaba nada), conserva el id/relaciones. ----
h = harness([{ id: 'c1', nombre: 'Ana', telefono: '600', email: 'a@x.com', notas: 'vip', empresaId: 'E2' }], 'E1');
let ok = h.logica.anonimizarCliente('c1');
assert.equal(ok, false);
assert.equal(h.estado()[0].nombre, 'Ana', 'no debe anonimizar un cliente de otra empresa');
console.log('P06_ANONIMIZAR_OTRA_EMPRESA_RECHAZADO=PASS');

h = harness([{ id: 'c1', nombre: 'Ana', telefono: '600', email: 'a@x.com', notas: 'vip', empresaId: 'E1' }], 'E1');
ok = h.logica.anonimizarCliente('c1');
assert.equal(ok, true);
assert.equal(h.estado()[0].id, 'c1', 'el id se conserva: las referencias históricas (encargos) no se rompen');
assert.equal(h.estado()[0].nombre, 'Cliente anonimizado');
assert.equal(h.estado()[0].telefono, '');
assert.equal(h.estado()[0].email, '');
assert.equal(h.estado()[0].notas, '');
assert.equal(h.estado()[0].anonimizado, true);
console.log('P06_ANONIMIZAR_MISMA_EMPRESA_OK=PASS');

// ---- Sincronización en segundo plano con clientes_empresa no bloquea el alta local. ----
const llamadas = [];
ctx.window = {
  __nubeActiva: true,
  getSupabaseClient: async () => ({
    from: (tabla) => ({
      upsert: async (fila) => { llamadas.push({ tabla, op: 'upsert', fila }); return { error: null }; },
      delete: () => ({ eq: () => ({ eq: async () => { llamadas.push({ tabla, op: 'delete' }); return { error: null }; } }) })
    })
  })
};
h = harness([], 'E1');
const antes = Date.now();
r = h.logica.addCliente({ nombre: 'Bea' });
assert.ok(Date.now() - antes < 50, 'addCliente no debe esperar a la sincronización remota');
assert.ok(r.id);
await new Promise((resolve) => setTimeout(resolve, 10));
assert.ok(llamadas.some((l) => l.tabla === 'clientes_empresa' && l.op === 'upsert' && l.fila.id === r.id && l.fila.empresa_id === 'E1'));
console.log('P06_SYNC_CLIENTES_EMPRESA_EN_SEGUNDO_PLANO=PASS');

delete ctx.window;
console.log('PM14 P06 Clientes — aislamiento por empresa y anonimización: contrato OK');
