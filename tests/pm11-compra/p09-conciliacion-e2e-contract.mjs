import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');
const p02 = fs.readFileSync('tests/pm11-compra/P02_CONTRATO_E2E_ESTADOS.md', 'utf8');
const p07 = fs.readFileSync('tests/pm11-compra/P07_AISLAMIENTO_PERMISOS_E2E.md', 'utf8');

// P09 no inventa un modelo nuevo: demuestra las conciliaciones congeladas en P02.
for (const patron of [
  /pedido = recibido acumulado \+ pendiente de recibir/,
  /stock neto incrementado = suma de unidades de recepciones confirmadas únicas/,
  /total factura = pagado \+ pendiente/,
  /nuevo pendiente = pendiente anterior \+ importe reversado/,
  /ningún paso del caso A1 puede aparecer como escritura válida en A2\/B1\/`Todos los locales`/
]) assert.match(p02, patron);

// ---------------------------------------------------------------------------
// 1) Pedido -> recepciones únicas -> stock: usamos la lógica REAL de pedidos.
// ---------------------------------------------------------------------------
const helpersIni = src.indexOf('function valorFirmaRecepcionPM11(');
const pedidosIni = src.indexOf('function crearLogicaPedidos(', helpersIni);
const pedidosFin = src.indexOf('function crearLogicaFichasCosto', pedidosIni);
const pm10Ini = src.indexOf('function errorValidacionPM10');
const pm10Fin = src.indexOf('function crearLogicaProductos', pm10Ini);
const validadoresPedidoIni = src.indexOf('function fechaValidaPedidoPM10');
assert.ok(helpersIni >= 0 && pedidosIni > helpersIni && pedidosFin > pedidosIni, 'lógica PM11 de pedidos localizada');
assert.ok(pm10Ini >= 0 && pm10Fin > pm10Ini && validadoresPedidoIni >= 0, 'validadores PM10 localizados');

const ctx = {
  uid: (() => { let n = 0; return () => `p09-uid-${++n}`; })(),
  todayISO: () => '2026-09-07'
};
vm.createContext(ctx);
vm.runInContext(src.slice(pm10Ini, pm10Fin), ctx);
vm.runInContext(src.slice(validadoresPedidoIni, pedidosIni), ctx);
vm.runInContext(src.slice(pedidosIni, pedidosFin), ctx);
assert.equal(typeof ctx.crearLogicaPedidos, 'function');

const productos = [
  { id: 'p1', localId: 'L1', nombre: 'Harina', costo: 10, ivaCompra: 21, udsPorCaja: 1 },
  { id: 'p2', localId: 'L1', nombre: 'Aceite', costo: 5, ivaCompra: 10, udsPorCaja: 1 }
];
const proveedores = [{ id: 'prov-1' }];
let estado = [{
  id: 'ped-p09', localId: 'L1', proveedorId: 'prov-1', estado: 'Pendiente',
  items: [
    { productoId: 'p1', cantidad: 5, costoUnitario: 10, cantidadRecibida: 0 },
    { productoId: 'p2', cantidad: 3, costoUnitario: 5, cantidadRecibida: 0 }
  ]
}];

const stockFisico = new Map([['p1', 0], ['p2', 0]]);
const efectosFisicos = new Map();
let llamadasFisicas = 0;

function procesadorFisico({ lineas, operationId, concurrencyKey }) {
  llamadasFisicas += 1;
  assert.ok(operationId, 'cada recepción conserva attempt operationId');
  assert.ok(concurrencyKey, 'cada recepción lleva versión física P08');
  const anterior = efectosFisicos.get(concurrencyKey);
  if (anterior) return { ...anterior, replayed: true };
  const lineasResueltas = lineas.map((ln) => ({ ...ln, unidadesEntradas: Number(ln.cantidad) }));
  for (const ln of lineasResueltas) {
    stockFisico.set(ln.productoId, (stockFisico.get(ln.productoId) || 0) + ln.unidadesEntradas);
  }
  const resultado = { ok: true, operationId, concurrencyKey, replayed: false, lineasResueltas, avisos: [] };
  efectosFisicos.set(concurrencyKey, resultado);
  return resultado;
}

function crearLogica(snapshot = structuredClone(estado), localActivoId = 'L1') {
  return ctx.crearLogicaPedidos({
    pedidos: snapshot,
    setPedidos: (fn) => { estado = fn(estado); },
    productos,
    proveedores,
    setProductos: () => {},
    setMovimientos: () => {},
    almacenCongelado: false,
    procesarRecepcion: procesadorFisico,
    localActivoId
  });
}

function pendienteLinea(item) {
  return Number(item.cantidad) - Number(item.cantidadRecibida || 0);
}
function recibidoEventos(pedido, productoId) {
  return (pedido.recepcionesPM11 || []).reduce((total, evento) => total + (evento.lineas || [])
    .filter((ln) => ln.productoId === productoId)
    .reduce((s, ln) => s + Number(ln.unidadesEntradas || 0), 0), 0);
}
function conciliarPedido(pedido) {
  for (const item of pedido.items) {
    const pedidoCantidad = Number(item.cantidad);
    const recibido = Number(item.cantidadRecibida || 0);
    const pendiente = pendienteLinea(item);
    assert.equal(pedidoCantidad, recibido + pendiente, `${item.productoId}: pedido = recibido + pendiente`);
    assert.equal(recibidoEventos(pedido, item.productoId), recibido, `${item.productoId}: eventos únicos = recibido acumulado`);
    assert.equal(stockFisico.get(item.productoId), recibido, `${item.productoId}: stock neto = recepciones únicas`);
  }
}

// Recepción 1: parcial de las dos líneas.
let logica = crearLogica();
let r = logica.recibirPedido('ped-p09', [
  { productoId: 'p1', cantidad: 2, precioBruto: 10, ivaPct: 21 },
  { productoId: 'p2', cantidad: 1, precioBruto: 5, ivaPct: 10 }
], 'p09-rx-1');
assert.equal(r.ok, true, JSON.stringify(r));
assert.equal(r.replayed, false);
assert.equal(estado[0].estado, 'Parcial');
assert.equal(estado[0].items[0].cantidadRecibida, 2);
assert.equal(estado[0].items[1].cantidadRecibida, 1);
conciliarPedido(estado[0]);
const stockTrasPrimera = JSON.stringify([...stockFisico]);
const eventosTrasPrimera = estado[0].recepcionesPM11.length;

// Replay exacto: cero segundo efecto físico/numérico.
r = logica.recibirPedido('ped-p09', [
  { productoId: 'p1', cantidad: 2, precioBruto: 10, ivaPct: 21 },
  { productoId: 'p2', cantidad: 1, precioBruto: 5, ivaPct: 10 }
], 'p09-rx-1');
assert.equal(r.ok, true);
assert.equal(r.replayed, true);
assert.equal(JSON.stringify([...stockFisico]), stockTrasPrimera);
assert.equal(estado[0].recepcionesPM11.length, eventosTrasPrimera);
conciliarPedido(estado[0]);

// Recepción 2 desde el snapshot actualizado: completa exactamente el pedido.
logica = crearLogica();
r = logica.recibirPedido('ped-p09', [
  { productoId: 'p1', cantidad: 3, precioBruto: 10, ivaPct: 21 },
  { productoId: 'p2', cantidad: 2, precioBruto: 5, ivaPct: 10 }
], 'p09-rx-2');
assert.equal(r.ok, true, JSON.stringify(r));
assert.equal(r.replayed, false);
assert.equal(estado[0].estado, 'Recibido');
assert.equal(estado[0].recepcionesPM11.length, 2);
for (const item of estado[0].items) {
  assert.equal(Number(item.cantidadRecibida), Number(item.cantidad), `${item.productoId}: recibido total exacto`);
  assert.equal(pendienteLinea(item), 0, `${item.productoId}: pendiente final cero`);
}
conciliarPedido(estado[0]);
assert.equal(stockFisico.get('p1'), 5);
assert.equal(stockFisico.get('p2'), 3);
assert.equal(efectosFisicos.size, 2, 'dos recepciones reales = dos efectos físicos únicos');

// Replay histórico después de completar: sigue siendo cero efecto.
const stockCompleto = JSON.stringify([...stockFisico]);
logica = crearLogica();
r = logica.recibirPedido('ped-p09', [
  { productoId: 'p1', cantidad: 2, precioBruto: 10, ivaPct: 21 },
  { productoId: 'p2', cantidad: 1, precioBruto: 5, ivaPct: 10 }
], 'p09-rx-1');
assert.equal(r.ok, true);
assert.equal(r.replayed, true);
assert.equal(JSON.stringify([...stockFisico]), stockCompleto);
assert.equal(estado[0].recepcionesPM11.length, 2);
conciliarPedido(estado[0]);

// ---------------------------------------------------------------------------
// 2) Pedido -> albarán/factura: identidad/contexto y total económico.
// ---------------------------------------------------------------------------
const facturaHelpersIni = src.indexOf('const confirmacionesAlbaranPM11Memoria');
const albaranesIni = src.indexOf('function crearLogicaAlbaranes({', facturaHelpersIni);
assert.ok(facturaHelpersIni >= 0 && albaranesIni > facturaHelpersIni, 'helpers documentales PM11 localizados');
const ctxFactura = {};
vm.createContext(ctxFactura);
vm.runInContext(src.slice(facturaHelpersIni, albaranesIni), ctxFactura);
assert.equal(typeof ctxFactura.validarIdentidadFacturaAlbaranPM11, 'function');

const factura = {
  id: 'alb-p09',
  pedidoId: estado[0].id,
  empresaId: 'E1',
  localId: estado[0].localId,
  proveedorId: estado[0].proveedorId,
  estado: 'confirmado',
  fecha: '2026-09-07',
  numero: 'ALB-P09',
  esFactura: true,
  numeroFactura: 'FAC-P09',
  fechaFactura: '2026-09-07',
  lineas: [
    { productoId: 'p1', cantidad: 5, precioBruto: 10, ivaPct: 21 },
    { productoId: 'p2', cantidad: 3, precioBruto: 5, ivaPct: 10 }
  ]
};
const identidadFactura = ctxFactura.validarIdentidadFacturaAlbaranPM11({
  alb: factura, albaranes: [], empresaId: 'E1', localActivoId: 'L1'
});
assert.equal(identidadFactura.ok, true, JSON.stringify(identidadFactura));
assert.equal(factura.pedidoId, estado[0].id);
assert.equal(factura.localId, estado[0].localId);
assert.equal(factura.proveedorId, estado[0].proveedorId);
assert.equal(identidadFactura.empresaId, 'E1');
assert.equal(identidadFactura.localId, 'L1');
assert.equal(identidadFactura.proveedorId, 'prov-1');

// Total numérico de la obligación: base + IVA, con las mismas líneas confirmadas.
const baseFactura = factura.lineas.reduce((s, ln) => s + Number(ln.cantidad) * Number(ln.precioBruto), 0);
const ivaFactura = factura.lineas.reduce((s, ln) => s + Number(ln.cantidad) * Number(ln.precioBruto) * Number(ln.ivaPct) / 100, 0);
const totalFactura = Math.round((baseFactura + ivaFactura) * 100) / 100;
assert.equal(baseFactura, 65);
assert.equal(Math.round(ivaFactura * 100) / 100, 12);
assert.equal(totalFactura, 77);

// La ruta real de pago toma el total de calcularTotalesFacturaAlbaran, no un total mutable externo.
const marcarIni = src.indexOf('  async function marcarPagada(id, pagada, importe)', albaranesIni);
const procesarIni = src.indexOf('  function procesarRecepcion({', marcarIni);
assert.ok(marcarIni >= 0 && procesarIni > marcarIni, 'ruta de pago de albarán localizada');
const marcar = src.slice(marcarIni, procesarIni);
assert.match(marcar, /calcularTotalesFacturaAlbaran\(a22\)\.total/);
assert.match(marcar, /validarIdentidadFacturaAlbaranPM11/);
assert.match(marcar, /origenFactura: "albaran"/);

// ---------------------------------------------------------------------------
// 3) Factura -> pago parcial -> pago total -> reverso: helper REAL PM06.
// ---------------------------------------------------------------------------
const saldoIni = src.indexOf('function redondearDineroPM06(');
const saldoFin = src.indexOf('function modoSincronizadoPM06(', saldoIni);
assert.ok(saldoIni >= 0 && saldoFin > saldoIni, 'helpers financieros PM06 localizados');
const ctxFin = { Math, Number };
vm.createContext(ctxFin);
vm.runInContext(src.slice(saldoIni, saldoFin), ctxFin);
assert.equal(typeof ctxFin.calcularSaldoFacturaPM06, 'function');

const claveFin = {
  facturaId: factura.id,
  origenFactura: 'albaran',
  empresaId: 'E1',
  localId: 'L1'
};
let pagos = [];
let saldo = ctxFin.calcularSaldoFacturaPM06(pagos, factura.id, 'albaran', totalFactura, 'E1', 'L1', false);
assert.equal(saldo.pagado, 0);
assert.equal(saldo.pendiente, 77);
assert.equal(totalFactura, saldo.pagado + saldo.pendiente);

// Pago parcial 30.
pagos.push({ ...claveFin, id: 'pay-p09-1', operationId: 'op-pay-p09-1', importe: 30, estado: 'CONFIRMADO' });
saldo = ctxFin.calcularSaldoFacturaPM06(pagos, factura.id, 'albaran', totalFactura, 'E1', 'L1', false);
assert.equal(saldo.pagado, 30);
assert.equal(saldo.pendiente, 47);
assert.equal(totalFactura, saldo.pagado + saldo.pendiente);

// Pago final exacto 47.
pagos.push({ ...claveFin, id: 'pay-p09-2', operationId: 'op-pay-p09-2', importe: 47, estado: 'CONFIRMADO' });
saldo = ctxFin.calcularSaldoFacturaPM06(pagos, factura.id, 'albaran', totalFactura, 'E1', 'L1', false);
assert.equal(saldo.pagado, 77);
assert.equal(saldo.pendiente, 0);
assert.equal(saldo.pagada, true);
assert.equal(totalFactura, saldo.pagado + saldo.pendiente);

// Reverso del pago final: reabre exactamente 47.
const pendienteAntesReverso = saldo.pendiente;
pagos.push({ ...claveFin, id: 'rev-p09-2', operationId: 'op-rev-p09-2', importe: 47, estado: 'REVERSO', reviertePagoId: 'pay-p09-2' });
saldo = ctxFin.calcularSaldoFacturaPM06(pagos, factura.id, 'albaran', totalFactura, 'E1', 'L1', false);
assert.equal(saldo.pagado, 30);
assert.equal(saldo.pendiente, 47);
assert.equal(saldo.pendiente, pendienteAntesReverso + 47, 'reverso reabre exactamente el importe revertido');
assert.equal(totalFactura, saldo.pagado + saldo.pendiente);

// Movimientos de otro local/empresa no contaminan la conciliación exacta.
const ajenos = [
  { ...claveFin, id: 'pay-a2', operationId: 'op-a2', localId: 'L2', importe: 999, estado: 'CONFIRMADO' },
  { ...claveFin, id: 'pay-b1', operationId: 'op-b1', empresaId: 'E2', importe: 999, estado: 'CONFIRMADO' }
];
const aislado = ctxFin.calcularSaldoFacturaPM06([...pagos, ...ajenos], factura.id, 'albaran', totalFactura, 'E1', 'L1', false);
assert.equal(aislado.pagado, 30);
assert.equal(aislado.pendiente, 47);
assert.match(p07, /A1/);
assert.match(p07, /A2/);
assert.match(p07, /B1/);
assert.match(p07, /Todos los locales/);

// La propia lógica de pedido rechaza escritura sobre un pedido de otro local.
const estadoSeguro = estado;
let estadoA2 = [{
  id: 'ped-a2', localId: 'L2', proveedorId: 'prov-1', estado: 'Pendiente',
  items: [{ productoId: 'p1', cantidad: 1, costoUnitario: 10, cantidadRecibida: 0 }]
}];
const logicaA2 = ctx.crearLogicaPedidos({
  pedidos: structuredClone(estadoA2),
  setPedidos: (fn) => { estadoA2 = fn(estadoA2); },
  productos, proveedores, setProductos: () => {}, setMovimientos: () => {},
  almacenCongelado: false, procesarRecepcion: procesadorFisico, localActivoId: 'L1'
});
r = logicaA2.recibirPedido('ped-a2', [{ productoId: 'p1', cantidad: 1, precioBruto: 10, ivaPct: 21 }], 'p09-a2-bloqueado');
assert.equal(r.ok, false);
assert.equal(estadoA2[0].items[0].cantidadRecibida, 0);
estado = estadoSeguro;

assert.ok(llamadasFisicas >= 2, 'hubo efectos físicos reales para conciliar');
console.log('PM11_COMPRA_P09_CONCILIACION_E2E=PASS');
