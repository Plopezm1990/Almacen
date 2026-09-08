import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');
const p01 = fs.readFileSync('tests/pm11-compra/P01_CHECKPOINT_INVENTARIO.md', 'utf8');
const p02 = fs.readFileSync('tests/pm11-compra/P02_CONTRATO_E2E_ESTADOS.md', 'utf8');
const g1 = fs.readFileSync('tests/g1/P07_CONCURRENCIA_REPLAY_EVIDENCIA.md', 'utf8');
const pm10p10 = fs.readFileSync('tests/pm10/P10_AUTORIDAD_PERSISTENCIA_EVIDENCIA.json', 'utf8');

// P08 debe existir en el plan y el plan prohíbe inventar ACID sobre KV.
assert.match(p01, /P08 — Fallos, replay y concurrencia/);
assert.match(p01, /PM11 no afirmará transacción ACID multientidad donde no exista/);
assert.match(p02, /error de validación\/nube \| sin avance falso/);

// Helpers reales P03+P08.
const helpersIni = src.indexOf('function valorFirmaRecepcionPM11(');
const pedidosIni = src.indexOf('function crearLogicaPedidos(', helpersIni);
assert.ok(helpersIni >= 0 && pedidosIni > helpersIni, 'helpers de recepción disponibles');
const ctxHelpers = {
  uid: (() => { let n = 0; return () => `id-${++n}`; })()
};
vm.createContext(ctxHelpers);
vm.runInContext(src.slice(helpersIni, pedidosIni), ctxHelpers);
for (const fn of ['snapshotRecepcionPedidoPM11', 'operationIdEfectoRecepcionPedidoPM11', 'firmaEfectoRecepcionPM11']) {
  assert.equal(typeof ctxHelpers[fn], 'function', `${fn} disponible`);
}

const pedV0 = {
  id: 'ped-c', localId: 'L1', proveedorId: 'prov-1',
  items: [{ productoId: 'p1', cantidad: 5, cantidadRecibida: 0 }]
};
const pedV2 = structuredClone(pedV0);
pedV2.items[0].cantidadRecibida = 2;
const k0a = ctxHelpers.operationIdEfectoRecepcionPedidoPM11(pedV0);
const k0b = ctxHelpers.operationIdEfectoRecepcionPedidoPM11(structuredClone(pedV0));
const k2 = ctxHelpers.operationIdEfectoRecepcionPedidoPM11(pedV2);
assert.equal(k0a, k0b, 'mismo snapshot produce misma clave física');
assert.notEqual(k0a, k2, 'nueva recepción real parte de una versión física distinta');
assert.match(k0a, /^pm11-efecto-recepcion-pedido:ped-c:/);

const firmaA = ctxHelpers.firmaEfectoRecepcionPM11({
  lineas: [{ productoId: 'p1', cantidad: 2, udsPorCaja: 1, precioBruto: 3, ivaPct: 10 }],
  proveedorId: 'prov-1', fecha: '2026-09-07', documentoTipo: 'pedido', documentoId: 'ped-c', documentoNumero: 'ped-c'
});
const firmaB = ctxHelpers.firmaEfectoRecepcionPM11({
  lineas: [{ productoId: 'p1', cantidad: 3, udsPorCaja: 1, precioBruto: 3, ivaPct: 10 }],
  proveedorId: 'prov-1', fecha: '2026-09-07', documentoTipo: 'pedido', documentoId: 'ped-c', documentoNumero: 'ped-c'
});
assert.notEqual(firmaA, firmaB, 'mismo key físico con payload distinto debe poder detectarse');

// Ejecutamos la lógica real de pedidos con un procesador que simula la barrera física.
const pm10Ini = src.indexOf('function errorValidacionPM10');
const pm10Fin = src.indexOf('function crearLogicaProductos', pm10Ini);
const p05Ini = src.indexOf('function fechaValidaPedidoPM10');
const pedidosFin = src.indexOf('function crearLogicaFichasCosto', pedidosIni);
assert.ok(pm10Ini >= 0 && pm10Fin > pm10Ini && p05Ini >= 0 && pedidosFin > pedidosIni);
const ctx = {
  uid: (() => { let n = 0; return () => `uid-${++n}`; })(),
  todayISO: () => '2026-09-07'
};
vm.createContext(ctx);
vm.runInContext(src.slice(pm10Ini, pm10Fin), ctx);
vm.runInContext(src.slice(p05Ini, pedidosIni), ctx);
vm.runInContext(src.slice(pedidosIni, pedidosFin), ctx);
assert.equal(typeof ctx.crearLogicaPedidos, 'function');

const productos = [{ id: 'p1', localId: 'L1', nombre: 'Harina', costo: 2, ivaCompra: 10, udsPorCaja: 1 }];
const proveedores = [{ id: 'prov-1' }];
let estado = [{
  id: 'ped-1', localId: 'L1', proveedorId: 'prov-1', estado: 'Pendiente',
  items: [{ productoId: 'p1', cantidad: 5, costoUnitario: 2, cantidadRecibida: 0 }]
}];
let mutaciones = 0;
let llamadas = 0;
const efectos = new Map();
function procesador({ lineas, operationId, concurrencyKey }) {
  llamadas += 1;
  assert.ok(operationId, 'intento conserva operationId P03');
  assert.ok(concurrencyKey, 'recepción crítica lleva clave física/versionada P08');
  const anterior = efectos.get(concurrencyKey);
  if (anterior) return { ...anterior, replayed: true };
  const r = { lineasResueltas: lineas.map(x => ({ ...x, unidadesEntradas: Number(x.cantidad) })), avisos: [], operationId, concurrencyKey, replayed: false };
  efectos.set(concurrencyKey, r);
  return r;
}
function crear(snapshot = structuredClone(estado), procesarRecepcion = procesador) {
  return ctx.crearLogicaPedidos({
    pedidos: snapshot,
    setPedidos: fn => { mutaciones += 1; estado = fn(estado); },
    productos, proveedores, setProductos: () => {}, setMovimientos: () => {},
    almacenCongelado: false, procesarRecepcion, localActivoId: 'L1'
  });
}

// Primer intento real desde versión 0.
let logica = crear();
let r = logica.recibirPedido('ped-1', [{ productoId: 'p1', cantidad: 2, precioBruto: 2, ivaPct: 10 }], 'rx-a');
assert.equal(r.ok, true, JSON.stringify(r));
assert.equal(estado[0].items[0].cantidadRecibida, 2);
assert.equal(estado[0].recepcionesPM11.length, 1);
const mutTrasPrimera = mutaciones;

// Mismo closure/snapshot obsoleto + otro attemptId: el procesador detecta la misma
// versión física. P08 debe fallar cerrado, no crear un segundo evento ni sumar pedido.
r = logica.recibirPedido('ped-1', [{ productoId: 'p1', cantidad: 2, precioBruto: 2, ivaPct: 10 }], 'rx-b-stale');
assert.equal(r.ok, false);
assert.equal(r.codigo, 'conflicto_estado_previo');
assert.equal(mutaciones, mutTrasPrimera, 'snapshot obsoleto no vuelve a mutar el pedido');
assert.equal(estado[0].items[0].cantidadRecibida, 2);
assert.equal(estado[0].recepcionesPM11.length, 1);

// Tras reconstruir desde estado actualizado, la versión física cambia y una nueva
// recepción real sí es aceptada.
logica = crear();
r = logica.recibirPedido('ped-1', [{ productoId: 'p1', cantidad: 2, precioBruto: 2, ivaPct: 10 }], 'rx-b');
assert.equal(r.ok, true, JSON.stringify(r));
assert.equal(estado[0].items[0].cantidadRecibida, 4);
assert.equal(estado[0].recepcionesPM11.length, 2);
assert.equal(efectos.size, 2, 'dos recepciones reales usan dos versiones físicas');

// Fallo del procesador/nube antes de confirmar el efecto: no avanza pedido ni crea evento.
const antesFallo = structuredClone(estado);
const mutAntesFallo = mutaciones;
logica = crear(undefined, () => ({ ok: false, codigo: 'fallo_nube', campo: 'recepcion', error: 'sin confirmación remota' }));
r = logica.recibirPedido('ped-1', [{ productoId: 'p1', cantidad: 1, precioBruto: 2, ivaPct: 10 }], 'rx-fallo');
assert.equal(r.ok, false);
assert.equal(r.codigo, 'fallo_nube');
assert.equal(mutaciones, mutAntesFallo);
assert.equal(JSON.stringify(estado), JSON.stringify(antesFallo));

// Contrato real de procesarRecepcion: replay con firma, conflicto de payload y
// deduplicación de movimientos por la clave física.
const albIni = src.indexOf('function crearLogicaAlbaranes({');
const procIni = src.indexOf('  function procesarRecepcion({', albIni);
const confIni = src.indexOf('  function confirmarAlbaran(alb) {', procIni);
assert.ok(albIni >= 0 && procIni > albIni && confIni > procIni);
const proc = src.slice(procIni, confIni);
for (const patron of [
  /concurrencyKey = null/,
  /claveEfectoRecepcionPM11/,
  /firmaEfectoRecepcionPM11/,
  /_pm10Resultados\.get\(claveEfectoRecepcionPM11\)/,
  /replayInmediatoPM10\.firmaEfectoPM11 !== firmaEfectoPM11/,
  /operation_id_conflict/,
  /_pm10Resultados\.set\(claveEfectoRecepcionPM11, resultadoRecepcionPM10\)/,
  /movimientoId: `\$\{claveEfectoRecepcionPM11\}:linea:/
]) assert.match(proc, patron);

// Albarán ligado conserva la identidad documental P04, pero usa la versión del
// pedido como clave de concurrencia y rechaza un replay físico no documental.
const confFin = src.indexOf('  function anularAlbaran(alb) {', confIni);
const confirmar = src.slice(confIni, confFin);
assert.match(confirmar, /operationId: `pm10-recepcion-albaran:\$\{alb\.id\}`/);
assert.match(confirmar, /concurrencyKey: pedidoLigado \? operationIdEfectoRecepcionPedidoPM11\(pedidoLigado\) : null/);
assert.match(confirmar, /if \(replayedRecepcionPM10\)/);
assert.match(confirmar, /versión del pedido enlazado ya fue usada por otra recepción/);

// Backend financiero heredado mantiene serialización real donde sí existe RPC.
assert.match(g1, /24\/24 PASS/);
assert.match(g1, /pg_advisory_xact_lock/);
assert.match(g1, /No se declara una prueba falsa de dos procesos simultáneos/);

// El límite KV se mantiene explícito: P08 no convierte una persistencia genérica
// en una transacción ACID por afirmación.
assert.match(pm10p10, /almacen_kv sigue siendo una tabla genérica JSONB/);
assert.match(pm10p10, /no existen tablas dedicadas de productos, pedidos, recepción/);

assert.ok(llamadas >= 3);
console.log('PM11_COMPRA_P08_FALLOS_REPLAY_CONCURRENCIA=PASS');
