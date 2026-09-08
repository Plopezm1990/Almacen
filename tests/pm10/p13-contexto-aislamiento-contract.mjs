import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');

const commonIni = src.indexOf('function errorValidacionPM10');
const productLogic = src.indexOf('function crearLogicaProductos', commonIni);
assert.ok(commonIni >= 0 && productLogic > commonIni, 'helpers PM10 presentes');

const ctx = {
  todayISO: () => '2026-09-05',
  uid: (() => { let n = 0; return () => `id-${++n}`; })()
};
vm.createContext(ctx);
vm.runInContext(src.slice(commonIni, productLogic), ctx);

const validarContexto = ctx.validarContextoEscrituraPM10;
assert.equal(typeof validarContexto, 'function');

const locales = [
  { id: 'QA-A1', empresaId: 'QA-EMP-A', activo: true },
  { id: 'QA-A2', empresaId: 'QA-EMP-A', activo: true },
  { id: 'QA-A-CERRADO', empresaId: 'QA-EMP-A', activo: false },
  { id: 'QA-A-FUSIONADO', empresaId: 'QA-EMP-A', activo: true, fusionadoEn: 'QA-A1' },
  { id: 'QA-B1', empresaId: 'QA-EMP-B', activo: true }
];

function expectFail(r, codigo, campo = 'localId') {
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.codigo, codigo, JSON.stringify(r));
  assert.equal(r.campo, campo, JSON.stringify(r));
}

assert.equal(validarContexto({ localActivoId: 'QA-A1', locales, empresaId: 'QA-EMP-A' }).ok, true);
assert.equal(validarContexto({ localActivoId: 'QA-A2', locales, empresaId: 'QA-EMP-A' }).ok, true);
assert.equal(validarContexto({ localActivoId: 'QA-B1', locales, empresaId: 'QA-EMP-B' }).ok, true);
expectFail(validarContexto({ localActivoId: null, locales, empresaId: 'QA-EMP-A' }), 'contexto_no_autorizado');
expectFail(validarContexto({ localActivoId: '', locales, empresaId: 'QA-EMP-A' }), 'contexto_no_autorizado');
expectFail(validarContexto({ localActivoId: 'TODOS', locales, empresaId: 'QA-EMP-A' }), 'referencia_inexistente');
expectFail(validarContexto({ localActivoId: 'QA-A-CERRADO', locales, empresaId: 'QA-EMP-A' }), 'local_inactivo');
expectFail(validarContexto({ localActivoId: 'QA-A-FUSIONADO', locales, empresaId: 'QA-EMP-A' }), 'local_inactivo');
expectFail(validarContexto({ localActivoId: 'QA-A1', locales, empresaId: 'QA-EMP-B' }), 'referencia_otro_contexto');

// Productos: el contrato específico sigue igual, pero la frontera add/update exige contexto antes de mutar.
const prodLogicEnd = src.indexOf('function crearLogicaReconciliacion', productLogic);
const prodTxt = src.slice(productLogic, prodLogicEnd > productLogic ? prodLogicEnd : productLogic + 30000);
assert.match(prodTxt.slice(0, 500), /locales = \[\]/);
const addIni = prodTxt.indexOf('function addProducto(data)');
const addFin = prodTxt.indexOf('function updateProducto', addIni);
const addTxt = prodTxt.slice(addIni, addFin);
assert.ok(addTxt.indexOf('validarProductoPM10') >= 0);
assert.ok(addTxt.indexOf('validarContextoEscrituraPM10') > addTxt.indexOf('validarProductoPM10'));
assert.ok(addTxt.indexOf('validarContextoEscrituraPM10') < addTxt.indexOf('setProductos('), 'producto valida contexto antes de persistir');
const updIni = prodTxt.indexOf('function updateProducto');
const updTxt = prodTxt.slice(updIni, updIni + 5500);
assert.ok(updTxt.indexOf('validarContextoEscrituraPM10') >= 0);
assert.ok(updTxt.indexOf('validarContextoEscrituraPM10') < updTxt.indexOf('setProductos('), 'edición producto valida contexto antes de persistir');

// Pedidos + Recepción.
const p05Ini = src.indexOf('function fechaValidaPedidoPM10');
const p05Logic = src.indexOf('function crearLogicaPedidos', p05Ini);
assert.ok(p05Ini >= 0 && p05Logic > p05Ini);
vm.runInContext(src.slice(p05Ini, p05Logic), ctx);
const validarPedido = ctx.validarPedidoPM10;
const validarRecepcion = ctx.validarRecepcionPedidoPM10;
assert.equal(typeof validarPedido, 'function');
assert.equal(typeof validarRecepcion, 'function');

const productos = [
  { id: 'pA1', localId: 'QA-A1', nombre: 'A1', costo: 2, ivaCompra: 10 },
  { id: 'pA2', localId: 'QA-A2', nombre: 'A2', costo: 2, ivaCompra: 10 },
  { id: 'pAC', localId: 'QA-A-CERRADO', nombre: 'Cerrado', costo: 2, ivaCompra: 10 },
  { id: 'pB1', localId: 'QA-B1', nombre: 'B1', costo: 2, ivaCompra: 10 }
];
const proveedores = [
  { id: 'provA', empresaId: 'QA-EMP-A' },
  { id: 'provB', empresaId: 'QA-EMP-B' },
  { id: 'provLegacy' }
];
const pedidoData = (productoId, proveedorId = 'provA') => ({ proveedorId, fechaEsperada: '', items: [{ productoId, cantidad: 2, costoUnitario: 3 }] });

let r = validarPedido(pedidoData('pA1'), { proveedores, productos, localActivoId: 'QA-A1', locales, empresaId: 'QA-EMP-A' });
assert.equal(r.ok, true, JSON.stringify(r));
r = validarPedido(pedidoData('pA2'), { proveedores, productos, localActivoId: 'QA-A2', locales, empresaId: 'QA-EMP-A' });
assert.equal(r.ok, true, JSON.stringify(r));
expectFail(validarPedido(pedidoData('pA2'), { proveedores, productos, localActivoId: 'QA-A1', locales, empresaId: 'QA-EMP-A' }), 'referencia_otro_contexto', 'items.0.productoId');
expectFail(validarPedido(pedidoData('pB1'), { proveedores, productos, localActivoId: 'QA-A1', locales, empresaId: 'QA-EMP-A' }), 'referencia_otro_contexto', 'items.0.productoId');
r = validarPedido(pedidoData('pB1', 'provB'), { proveedores, productos, localActivoId: 'QA-B1', locales, empresaId: 'QA-EMP-B' });
assert.equal(r.ok, true, JSON.stringify(r));
expectFail(validarPedido(pedidoData('pB1', 'provA'), { proveedores, productos, localActivoId: 'QA-B1', locales, empresaId: 'QA-EMP-B' }), 'referencia_otro_contexto', 'proveedorId');
r = validarPedido(pedidoData('pA1', 'provLegacy'), { proveedores, productos, localActivoId: 'QA-A1', locales, empresaId: 'QA-EMP-A' });
assert.equal(r.ok, true, 'proveedor legado sin empresa explícita no se reasigna ni se bloquea automáticamente');
expectFail(validarPedido(pedidoData('pAC'), { proveedores, productos, localActivoId: 'QA-A-CERRADO', locales, empresaId: 'QA-EMP-A' }), 'local_inactivo');
expectFail(validarPedido(pedidoData('pA1'), { proveedores, productos, localActivoId: 'TODOS', locales, empresaId: 'QA-EMP-A' }), 'referencia_inexistente');

const pedidoA1 = { id: 'pedA1', localId: 'QA-A1', proveedorId: 'provA', items: [{ productoId: 'pA1', cantidad: 5, cantidadRecibida: 2 }] };
r = validarRecepcion({ pedido: pedidoA1, lineas: [{ productoId: 'pA1', cantidad: 2 }], productos, localActivoId: 'QA-A1', locales, empresaId: 'QA-EMP-A', modo: 'directo' });
assert.equal(r.ok, true, JSON.stringify(r));
expectFail(validarRecepcion({ pedido: pedidoA1, lineas: [{ productoId: 'pA1', cantidad: 1 }], productos, localActivoId: 'QA-A2', locales, empresaId: 'QA-EMP-A', modo: 'directo' }), 'contexto_no_autorizado', 'pedidoId');
const pedidoCerrado = { id: 'pedC', localId: 'QA-A-CERRADO', proveedorId: 'provA', items: [{ productoId: 'pAC', cantidad: 5, cantidadRecibida: 0 }] };
expectFail(validarRecepcion({ pedido: pedidoCerrado, lineas: [{ productoId: 'pAC', cantidad: 1 }], productos, localActivoId: 'QA-A-CERRADO', locales, empresaId: 'QA-EMP-A', modo: 'directo' }), 'local_inactivo');

// Personal.
const empIni = src.indexOf('function validarEmpleadoPM10');
const empLogic = src.indexOf('function crearLogicaPersonal', empIni);
assert.ok(empIni >= 0 && empLogic > empIni);
vm.runInContext(src.slice(empIni, empLogic), ctx);
const validarEmpleado = ctx.validarEmpleadoPM10;
const empleado = { nombre: 'Empleado A1', localId: 'QA-A1', horasSemanales: 40, pagas: 14, salarioBrutoMensual: 1500, costeEmpresaMensual: '', diasVacacionesAnuales: 30 };
r = validarEmpleado(empleado, { localActivoId: 'QA-A1', locales, empresaId: 'QA-EMP-A' });
assert.equal(r.ok, true, JSON.stringify(r));
expectFail(validarEmpleado(empleado, { localActivoId: 'QA-A2', locales, empresaId: 'QA-EMP-A' }), 'referencia_otro_contexto');
expectFail(validarEmpleado({ ...empleado, localId: 'QA-A-CERRADO' }, { localActivoId: 'QA-A-CERRADO', locales, empresaId: 'QA-EMP-A' }), 'local_inactivo');

// Encargos.
const encIni = src.indexOf('function validarEncargoPM10');
const encLogic = src.indexOf('function crearLogicaEncargos', encIni);
assert.ok(encIni >= 0 && encLogic > encIni);
vm.runInContext(src.slice(encIni, encLogic), ctx);
const validarEncargo = ctx.validarEncargoPM10;
const clientes = [
  { id: 'cliA', empresaId: 'QA-EMP-A' },
  { id: 'cliB', empresaId: 'QA-EMP-B' }
];
const encargo = (localId, clienteId, productoId) => ({ clienteId, fechaEntrega: '2026-09-06', localId, señal: 0, lineas: [{ productoId, descripcion: 'x', cantidad: 1, precioUnitario: 10 }] });
r = validarEncargo(encargo('QA-A1', 'cliA', 'pA1'), { productos, clientes, localActivoId: 'QA-A1', locales, empresaId: 'QA-EMP-A', fechaCreacion: '2026-09-05' });
assert.equal(r.ok, true, JSON.stringify(r));
expectFail(validarEncargo(encargo('QA-A1', 'cliA', 'pA2'), { productos, clientes, localActivoId: 'QA-A1', locales, empresaId: 'QA-EMP-A', fechaCreacion: '2026-09-05' }), 'referencia_otro_contexto', 'lineas.0.productoId');
expectFail(validarEncargo(encargo('QA-B1', 'cliA', 'pB1'), { productos, clientes, localActivoId: 'QA-B1', locales, empresaId: 'QA-EMP-B', fechaCreacion: '2026-09-05' }), 'referencia_otro_contexto', 'clienteId');
r = validarEncargo(encargo('QA-B1', 'cliB', 'pB1'), { productos, clientes, localActivoId: 'QA-B1', locales, empresaId: 'QA-EMP-B', fechaCreacion: '2026-09-05' });
assert.equal(r.ok, true, JSON.stringify(r));
expectFail(validarEncargo(encargo('QA-A-CERRADO', 'cliA', 'pAC'), { productos, clientes, localActivoId: 'QA-A-CERRADO', locales, empresaId: 'QA-EMP-A', fechaCreacion: '2026-09-05' }), 'local_inactivo');

// Selector de local: no activa cerrados/fusionados y limpiar el actual al desactivarlo.
const locIni = src.indexOf('function crearLogicaLocales({');
const locFin = src.indexOf('function crearLogica', locIni + 30);
assert.ok(locIni >= 0 && locFin > locIni);
vm.runInContext(src.slice(locIni, locFin), ctx);
const crearLogicaLocales = ctx.crearLogicaLocales;
let localActivo = 'QA-A1';
let listaLocales = structuredClone(locales);
let cambiosActivo = 0;
const logicaLocales = crearLogicaLocales({
  locales: listaLocales,
  setLocales: (fn) => { listaLocales = fn(listaLocales); },
  localActivoId: localActivo,
  setLocalActivoId: (id) => { cambiosActivo += 1; localActivo = id; },
  registrarAuditoria: () => {}
});
assert.equal(logicaLocales.cambiarLocalActivo('QA-A-CERRADO'), false);
assert.equal(cambiosActivo, 0);
assert.equal(localActivo, 'QA-A1');
assert.equal(logicaLocales.cambiarLocalActivo('QA-A-FUSIONADO'), false);
assert.equal(cambiosActivo, 0);
assert.equal(logicaLocales.cambiarLocalActivo('QA-A2'), true);
assert.equal(localActivo, 'QA-A2');

// Nueva instancia con A1 activo para probar desactivación del actual.
localActivo = 'QA-A1';
cambiosActivo = 0;
const logicaLocales2 = crearLogicaLocales({
  locales: listaLocales,
  setLocales: (fn) => { listaLocales = fn(listaLocales); },
  localActivoId: localActivo,
  setLocalActivoId: (id) => { cambiosActivo += 1; localActivo = id; },
  registrarAuditoria: () => {}
});
logicaLocales2.desactivarLocal('QA-A1');
assert.equal(localActivo, null);
assert.equal(cambiosActivo, 1);
assert.equal(listaLocales.find(x => x.id === 'QA-A1').activo, false);

// "Todos los locales" conserva un estado de informe separado y no sustituye el local de escritura.
const selectorIni = src.indexOf('function seleccionarContextoLocal(id)');
const selectorTxt = src.slice(selectorIni, selectorIni + 700);
assert.ok(selectorIni >= 0);
assert.match(selectorTxt, /setLocalInformeId\(siguiente\)/);
assert.match(selectorTxt, /if \(siguiente && locales\.some/);
assert.match(selectorTxt, /cambiarLocalActivo\(siguiente\)/);
assert.doesNotMatch(selectorTxt, /if \(!siguiente\)[\s\S]{0,200}setLocalActivoId/);

// Wiring real: las cinco fronteras reciben locales; Pedidos/Personal/Encargos reciben empresa activa.
assert.match(src, /crearLogicaProductos\(\{[^\n]*localActivoId, locales \}\)/);
assert.match(src, /crearLogicaPedidos\(\{[^\n]*localActivoId, locales, empresaId: empresaDelLocalActivo\?\.id \|\| null \}\)/);
assert.match(src, /crearLogicaPersonal\(\{[^\n]*localActivoId, locales, empresaId: empresaDelLocalActivo\?\.id \|\| null \}\)/);
assert.match(src, /crearLogicaEncargos\(\{[^\n]*empresaId: empresaDelLocalActivo\?\.id \|\| null, locales \}\)/);
assert.match(src, /crearLogicaAlbaranes\(\{[\s\S]{0,900}localActivoId,[\s\S]{0,80}locales,[\s\S]{0,80}empresaId:/);

console.log('PM10 P13 aislamiento/contexto A1-A2-B1-Todos-inactivo: contrato OK');
