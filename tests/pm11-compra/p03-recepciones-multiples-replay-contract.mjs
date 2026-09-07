import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');

const p04Ini = src.indexOf('function errorValidacionPM10');
const p04Fin = src.indexOf('function crearLogicaProductos', p04Ini);
const p05Ini = src.indexOf('function fechaValidaPedidoPM10');
const pedidosIni = src.indexOf('function crearLogicaPedidos', p05Ini);
const pedidosFin = src.indexOf('function crearLogicaFichasCosto', pedidosIni);
assert.ok(p04Ini >= 0 && p04Fin > p04Ini, 'helpers PM10 disponibles');
assert.ok(p05Ini >= 0 && pedidosIni > p05Ini && pedidosFin > pedidosIni, 'lógica de pedidos disponible');

const ctx = {
  uid: (() => { let n = 0; return () => `id-${++n}`; })(),
  todayISO: () => '2026-09-07'
};
vm.createContext(ctx);
vm.runInContext(src.slice(p04Ini, p04Fin), ctx);
vm.runInContext(src.slice(p05Ini, pedidosIni), ctx);
vm.runInContext(src.slice(pedidosIni, pedidosFin), ctx);

const crearLogicaPedidos = ctx.crearLogicaPedidos;
assert.equal(typeof crearLogicaPedidos, 'function');
assert.equal(typeof ctx.firmaSolicitudRecepcionPM11, 'function');
assert.equal(typeof ctx.eventoRecepcionPM11EnPedidos, 'function');

const productos = [
  { id: 'p1', localId: 'L1', nombre: 'Harina', costo: 2, ivaCompra: 10, udsPorCaja: 1 },
  { id: 'p2', localId: 'L1', nombre: 'Aceite', costo: 4, ivaCompra: 10, udsPorCaja: 1 }
];
const proveedores = [{ id: 'prov-1' }];

let estado = [{
  id: 'ped-1',
  localId: 'L1',
  proveedorId: 'prov-1',
  estado: 'Pendiente',
  items: [{ productoId: 'p1', cantidad: 5, costoUnitario: 2, cantidadRecibida: 0 }]
}];
let procesadas = 0;
let mutaciones = 0;

function crear(snapshot = structuredClone(estado)) {
  return crearLogicaPedidos({
    pedidos: snapshot,
    setPedidos: (fn) => { mutaciones += 1; estado = fn(estado); },
    productos,
    proveedores,
    setProductos: () => {},
    setMovimientos: () => {},
    almacenCongelado: false,
    procesarRecepcion: ({ lineas }) => {
      procesadas += 1;
      return {
        lineasResueltas: lineas.map((ln) => ({ ...ln, unidadesEntradas: Number(ln.cantidad) })),
        avisos: []
      };
    },
    localActivoId: 'L1'
  });
}

// Primera recepción real: 2/5.
let logica = crear();
let r = logica.recibirPedido('ped-1', [{ productoId: 'p1', cantidad: 2, precioBruto: 2, ivaPct: 10 }], 'rx-1');
assert.equal(r.ok, true, JSON.stringify(r));
assert.equal(r.replayed, false);
assert.equal(r.operationId, 'rx-1');
assert.equal(procesadas, 1);
assert.equal(estado[0].items[0].cantidadRecibida, 2);
assert.equal(estado[0].estado, 'Parcial');
assert.equal(estado[0].recepcionesPM11.length, 1);
assert.equal(estado[0].recepcionesPM11[0].operationId, 'rx-1');
assert.equal(estado[0].recepcionesPM11[0].lineas[0].unidadesEntradas, 2);

// Doble clic/replay en la misma renderización: cero efecto adicional.
r = logica.recibirPedido('ped-1', [{ productoId: 'p1', cantidad: 2, precioBruto: 2, ivaPct: 10 }], 'rx-1');
assert.equal(r.ok, true);
assert.equal(r.replayed, true);
assert.equal(procesadas, 1, 'replay inmediato no vuelve a tocar stock');
assert.equal(estado[0].items[0].cantidadRecibida, 2);
assert.equal(estado[0].recepcionesPM11.length, 1);

// Misma operationId con contenido distinto es conflicto.
r = logica.recibirPedido('ped-1', [{ productoId: 'p1', cantidad: 3, precioBruto: 2, ivaPct: 10 }], 'rx-1');
assert.equal(r.ok, false);
assert.equal(r.codigo, 'operation_id_conflict');
assert.equal(procesadas, 1);
assert.equal(estado[0].items[0].cantidadRecibida, 2);

// Segunda recepción física real usa una identidad nueva.
logica = crear();
r = logica.recibirPedido('ped-1', [{ productoId: 'p1', cantidad: 2, precioBruto: 2, ivaPct: 10 }], 'rx-2');
assert.equal(r.ok, true);
assert.equal(r.replayed, false);
assert.equal(procesadas, 2);
assert.equal(estado[0].items[0].cantidadRecibida, 4);
assert.equal(estado[0].estado, 'Parcial');
assert.deepEqual(estado[0].recepcionesPM11.map(x => x.operationId), ['rx-1', 'rx-2']);

// Tercera recepción exacta del resto cierra cuantitativamente el pedido.
logica = crear();
r = logica.recibirPedido('ped-1', [{ productoId: 'p1', cantidad: 1, precioBruto: 2, ivaPct: 10 }], 'rx-3');
assert.equal(r.ok, true);
assert.equal(procesadas, 3);
assert.equal(estado[0].items[0].cantidadRecibida, 5);
assert.equal(estado[0].estado, 'Recibido');
assert.equal(estado[0].recepcionesPM11.length, 3);
assert.equal(estado[0].recepcionesPM11.reduce((a, ev) => a + ev.lineas.reduce((b, ln) => b + ln.unidadesEntradas, 0), 0), 5);

// Replay persistido sigue siendo inocuo incluso cuando ya no queda pendiente.
logica = crear();
r = logica.recibirPedido('ped-1', [{ productoId: 'p1', cantidad: 2, precioBruto: 2, ivaPct: 10 }], 'rx-1');
assert.equal(r.ok, true);
assert.equal(r.replayed, true);
assert.equal(procesadas, 3, 'replay histórico no revalida como nueva recepción ni toca stock');
assert.equal(estado[0].items[0].cantidadRecibida, 5);

// Una identidad ya usada no puede reinterpretarse para otro pedido.
const otro = {
  id: 'ped-2', localId: 'L1', proveedorId: 'prov-1', estado: 'Pendiente',
  items: [{ productoId: 'p1', cantidad: 10, costoUnitario: 2, cantidadRecibida: 0 }]
};
const estadoAnterior = estado;
let estadoDos = [...structuredClone(estado), otro];
const setPedidosDos = (fn) => { estadoDos = fn(estadoDos); };
const logicaDos = crearLogicaPedidos({
  pedidos: structuredClone(estadoDos), setPedidos: setPedidosDos, productos, proveedores,
  setProductos: () => {}, setMovimientos: () => {}, almacenCongelado: false,
  procesarRecepcion: ({ lineas }) => { procesadas += 1; return { lineasResueltas: lineas.map(x => ({ ...x, unidadesEntradas: x.cantidad })), avisos: [] }; },
  localActivoId: 'L1'
});
r = logicaDos.recibirPedido('ped-2', [{ productoId: 'p1', cantidad: 2, precioBruto: 2, ivaPct: 10 }], 'rx-1');
assert.equal(r.ok, false);
assert.equal(r.codigo, 'operation_id_conflict');
assert.equal(procesadas, 3);
estado = estadoAnterior;

// Un intento inválido no reserva operationId ni crea evento.
logica = crear();
r = logica.recibirPedido('ped-1', [{ productoId: 'p1', cantidad: 0 }], 'rx-invalida');
assert.equal(r.ok, false);
assert.equal(procesadas, 3);
assert.equal(estado[0].recepcionesPM11.some(x => x.operationId === 'rx-invalida'), false);

// La ruta nueva exige que la UI entregue una identidad estable por intento.
const recepcionIni = src.indexOf('function Recepcion({');
const recepcionFin = src.indexOf('function textoHojaConteo(', recepcionIni);
const recepcionTxt = src.slice(recepcionIni, recepcionFin);
assert.match(recepcionTxt, /operacionesRecepcionRef/);
assert.match(recepcionTxt, /recibido: pe2\.items\.map/);
assert.match(recepcionTxt, /operationId: `rx-ui-\$\{uid\(\)\}`/);
assert.match(recepcionTxt, /recibirPedido\(pe2\.id, lineasIntento, intento\.operationId\)/);

const pedidosTxt = src.slice(pedidosIni, pedidosFin);
assert.match(pedidosTxt, /resolverOperationIdRecepcionPM11/);
assert.match(pedidosTxt, /eventoRecepcionPM11EnPedidos/);
assert.match(pedidosTxt, /operation_id_conflict/);
assert.match(pedidosTxt, /recepcionesPM11/);
assert.ok(pedidosTxt.indexOf('eventoRecepcionPM11EnPedidos') < pedidosTxt.indexOf('validarRecepcionPedidoPM10'), 'replay persistido se resuelve antes de validar saldo actual');

assert.ok(mutaciones >= 3, 'las recepciones reales sí mutaron el pedido');
console.log('PM11_COMPRA_P03_RECEPCIONES_MULTIPLES_REPLAY=PASS');
