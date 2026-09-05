import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');

const p04Ini = src.indexOf('function errorValidacionPM10');
const p04Fin = src.indexOf('function crearLogicaProductos', p04Ini);
const p05Ini = src.indexOf('function fechaValidaPedidoPM10');
const pedidosIni = src.indexOf('function crearLogicaPedidos', p05Ini);
const pedidosFin = src.indexOf('function crearLogicaFichasCosto', pedidosIni);
assert.ok(p04Ini >= 0 && p04Fin > p04Ini, 'helpers numéricos PM10 disponibles');
assert.ok(p05Ini >= 0 && pedidosIni > p05Ini && pedidosFin > pedidosIni, 'helpers/lógica Pedidos disponibles');

const ctx = {
  uid: (() => { let n = 0; return () => `id-${++n}`; })(),
  todayISO: () => '2026-09-05'
};
vm.createContext(ctx);
vm.runInContext(src.slice(p04Ini, p04Fin), ctx);
vm.runInContext(src.slice(p05Ini, pedidosIni), ctx);
vm.runInContext(src.slice(pedidosIni, pedidosFin), ctx);

const validar = ctx.validarRecepcionPedidoPM10;
const aplicar = ctx.aplicarRecepcionPedidoPM10;
const crearLogicaPedidos = ctx.crearLogicaPedidos;
assert.equal(typeof validar, 'function');
assert.equal(typeof aplicar, 'function');
assert.equal(typeof crearLogicaPedidos, 'function');

const productos = [
  { id: 'p1', localId: 'L1', nombre: 'Producto 1', costo: 3, ivaCompra: 10, udsPorCaja: 24 },
  { id: 'p2', localId: 'L1', nombre: 'Producto 2', costo: 4, ivaCompra: 21, udsPorCaja: 1 },
  { id: 'px', localId: 'L1', nombre: 'No pedido', costo: 2, ivaCompra: 10, udsPorCaja: 1 },
  { id: 'otro', localId: 'L2', nombre: 'Otro local', costo: 2, ivaCompra: 10, udsPorCaja: 1 }
];

const pedidoBase = {
  id: 'ped-1',
  localId: 'L1',
  proveedorId: 'prov-1',
  estado: 'Parcial',
  items: [
    { productoId: 'p1', cantidad: 10, costoUnitario: 3, cantidadRecibida: 4 },
    { productoId: 'p2', cantidad: 5, costoUnitario: 4, cantidadRecibida: 0 }
  ]
};
const opts = { pedido: pedidoBase, productos, localActivoId: 'L1', modo: 'directo' };

function falla(lineas, codigo, campo = null, extra = {}) {
  const r = validar({ ...opts, lineas, ...extra });
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.codigo, codigo, JSON.stringify(r));
  if (campo !== null) assert.equal(r.campo, campo, JSON.stringify(r));
  return r;
}

// Parcial y exacto al pendiente.
let r = validar({ ...opts, lineas: [{ productoId: 'p1', cantidad: 3, precioBruto: 3, ivaPct: 10 }] });
assert.equal(r.ok, true, JSON.stringify(r));
assert.equal(r.lineas[0].cantidad, 3);
assert.equal(r.lineas[0].udsPorCaja, 1, 'Cant. hoy expresa unidades, no cajas');
assert.equal(r.lineas[0].importe, 9);

r = validar({ ...opts, lineas: [{ productoId: 'p1', cantidad: 6 }] });
assert.equal(r.ok, true, JSON.stringify(r));
assert.equal(r.lineas[0].cantidad, 6);
assert.equal(r.lineas[0].precioBruto, 3, 'usa coste actual solo como valor por defecto de captura');

// Un mínimo exceso debe bloquear el lote completo.
falla([{ productoId: 'p1', cantidad: 6.01 }], 'exceso_sobre_cantidad_pendiente', 'lineas');
falla([
  { productoId: 'p1', cantidad: 2 },
  { productoId: 'p2', cantidad: 5.01 }
], 'exceso_sobre_cantidad_pendiente', 'lineas');

// Números y referencias inválidas no se silencian.
falla([{ productoId: 'p1', cantidad: 0 }], 'valor_fuera_rango', 'lineas.0.cantidad');
falla([{ productoId: 'p1', cantidad: -1 }], 'valor_fuera_rango', 'lineas.0.cantidad');
falla([{ productoId: 'p1', cantidad: 'abc' }], 'numero_no_finito', 'lineas.0.cantidad');
falla([{ productoId: 'p1', cantidad: Infinity }], 'numero_no_finito', 'lineas.0.cantidad');
falla([{ productoId: '', cantidad: 1 }], 'campo_obligatorio', 'lineas.0.productoId');
falla([{ productoId: 'no-existe', cantidad: 1 }], 'referencia_inexistente', 'lineas.0.productoId');
falla([{ productoId: 'otro', cantidad: 1 }], 'referencia_otro_contexto', 'lineas.0.productoId');
falla([{ productoId: 'px', cantidad: 1 }], 'referencia_inexistente', 'lineas.0.productoId');
falla([{ productoId: 'p1', cantidad: 1, precioBruto: -0.01 }], 'valor_fuera_rango', 'lineas.0.precioBruto');
falla([{ productoId: 'p1', cantidad: 1, precioBruto: 'abc' }], 'numero_no_finito', 'lineas.0.precioBruto');
falla([{ productoId: 'p1', cantidad: 1, ivaPct: 101 }], 'valor_fuera_rango', 'lineas.0.ivaPct');
falla([], 'campo_obligatorio', 'lineas');
falla([{ productoId: 'p1', cantidad: 1 }], 'contexto_no_autorizado', 'localId', { localActivoId: null });

// Estado previo incoherente debe fallar antes de cualquier entrada.
const pedidoCorrupto = { ...pedidoBase, items: [{ productoId: 'p1', cantidad: 5, cantidadRecibida: 6 }] };
r = validar({ pedido: pedidoCorrupto, lineas: [{ productoId: 'p1', cantidad: 1 }], productos, localActivoId: 'L1', modo: 'directo' });
assert.equal(r.ok, false);
assert.equal(r.codigo, 'conflicto_estado_previo');

// En albarán, cantidad * udsPorCaja se compara en unidades contra el pendiente.
const pedidoCaja = {
  id: 'ped-caja', localId: 'L1', proveedorId: 'prov-1', estado: 'Pendiente',
  items: [{ productoId: 'p1', cantidad: 12, costoUnitario: 3, cantidadRecibida: 0 }]
};
r = validar({ pedido: pedidoCaja, lineas: [{ productoId: 'p1', cantidad: 2, udsPorCaja: 6, tipoUnidad: 'unidad' }], productos, localActivoId: 'L1', modo: 'albaran' });
assert.equal(r.ok, true, JSON.stringify(r));
assert.equal(r.lineas[0].cantidad, 2);
assert.equal(r.lineas[0].udsPorCaja, 6);
r = validar({ pedido: pedidoCaja, lineas: [{ productoId: 'p1', cantidad: 2.01, udsPorCaja: 6, tipoUnidad: 'unidad' }], productos, localActivoId: 'L1', modo: 'albaran' });
assert.equal(r.ok, false);
assert.equal(r.codigo, 'exceso_sobre_cantidad_pendiente');

// Productos repetidos en el pedido: el pendiente se agrega y la recepción se reparte, no se duplica.
const pedidoDuplicado = {
  id: 'ped-dup', localId: 'L1', proveedorId: 'prov-1', estado: 'Parcial',
  items: [
    { productoId: 'p1', cantidad: 5, cantidadRecibida: 4 },
    { productoId: 'p1', cantidad: 5, cantidadRecibida: 1 }
  ]
};
r = validar({ pedido: pedidoDuplicado, lineas: [{ productoId: 'p1', cantidad: 5 }], productos, localActivoId: 'L1', modo: 'directo' });
assert.equal(r.ok, true, JSON.stringify(r));
let actualizado = aplicar(pedidoDuplicado, [{ productoId: 'p1', unidadesEntradas: 5 }]);
assert.deepEqual(actualizado.items.map(x => x.cantidadRecibida), [5, 5]);
assert.equal(actualizado.estado, 'Recibido');

// Varias recepciones parciales acumulan exactamente y el exceso posterior se rechaza.
let pedidoSecuencia = {
  id: 'ped-seq', localId: 'L1', proveedorId: 'prov-1', estado: 'Pendiente',
  items: [{ productoId: 'p2', cantidad: 5, cantidadRecibida: 0 }]
};
r = validar({ pedido: pedidoSecuencia, lineas: [{ productoId: 'p2', cantidad: 2 }], productos, localActivoId: 'L1', modo: 'directo' });
assert.equal(r.ok, true);
pedidoSecuencia = aplicar(pedidoSecuencia, [{ productoId: 'p2', unidadesEntradas: 2 }]);
assert.equal(pedidoSecuencia.items[0].cantidadRecibida, 2);
assert.equal(pedidoSecuencia.estado, 'Parcial');
r = validar({ pedido: pedidoSecuencia, lineas: [{ productoId: 'p2', cantidad: 3 }], productos, localActivoId: 'L1', modo: 'directo' });
assert.equal(r.ok, true);
pedidoSecuencia = aplicar(pedidoSecuencia, [{ productoId: 'p2', unidadesEntradas: 3 }]);
assert.equal(pedidoSecuencia.items[0].cantidadRecibida, 5);
assert.equal(pedidoSecuencia.estado, 'Recibido');
r = validar({ pedido: pedidoSecuencia, lineas: [{ productoId: 'p2', cantidad: 0.01 }], productos, localActivoId: 'L1', modo: 'directo' });
assert.equal(r.ok, false);
assert.equal(r.codigo, 'exceso_sobre_cantidad_pendiente');

// Dominio real de recibirPedido: inválido no llama procesarRecepcion ni setPedidos; válido sí y suma exacto.
function harness(pedidoInicial) {
  let estado = structuredClone([pedidoInicial]);
  let llamadasProcesar = 0;
  let mutacionesPedidos = 0;
  let ultimaEntrada = null;
  const setPedidos = (fn) => { mutacionesPedidos += 1; estado = fn(estado); };
  const logica = crearLogicaPedidos({
    pedidos: [pedidoInicial],
    setPedidos,
    productos,
    proveedores: [{ id: 'prov-1' }],
    setProductos: () => {},
    setMovimientos: () => {},
    almacenCongelado: false,
    procesarRecepcion: ({ lineas }) => {
      llamadasProcesar += 1;
      ultimaEntrada = structuredClone(lineas);
      return { lineasResueltas: lineas.map(x => ({ ...x, unidadesEntradas: x.cantidad })), avisos: [] };
    },
    localActivoId: 'L1'
  });
  return { logica, estado: () => estado, llamadasProcesar: () => llamadasProcesar, mutacionesPedidos: () => mutacionesPedidos, ultimaEntrada: () => ultimaEntrada };
}

let h = harness(pedidoBase);
let res = h.logica.recibirPedido('ped-1', [{ productoId: 'p1', cantidad: 7 }]);
assert.equal(res.ok, false);
assert.equal(res.codigo, 'exceso_sobre_cantidad_pendiente');
assert.equal(h.llamadasProcesar(), 0, 'sobre-recepción no toca procesarRecepcion');
assert.equal(h.mutacionesPedidos(), 0, 'sobre-recepción no toca pedido');
res = h.logica.recibirPedido('ped-1', [{ productoId: 'p1', cantidad: 2 }]);
assert.equal(res.ok, true, JSON.stringify(res));
assert.equal(h.llamadasProcesar(), 1);
assert.equal(h.mutacionesPedidos(), 1);
assert.equal(h.ultimaEntrada()[0].cantidad, 2);
assert.equal(h.ultimaEntrada()[0].udsPorCaja, 1, 'la UI directa no multiplica por uds/caja del producto');
assert.equal(h.estado()[0].items[0].cantidadRecibida, 6);

// Todo o nada en lote: una segunda línea inválida impide incluso procesar la primera.
h = harness(pedidoBase);
res = h.logica.recibirPedido('ped-1', [{ productoId: 'p1', cantidad: 1 }, { productoId: 'p2', cantidad: 6 }]);
assert.equal(res.ok, false);
assert.equal(h.llamadasProcesar(), 0);
assert.equal(h.mutacionesPedidos(), 0);

// Evidencia estática de orden de autoridad en ambas rutas.
const logicaPedidosTxt = src.slice(pedidosIni, pedidosFin);
const recibirIni = logicaPedidosTxt.indexOf('function recibirPedido(');
const recibirFin = logicaPedidosTxt.indexOf('return { crearPedido', recibirIni);
const recibirTxt = logicaPedidosTxt.slice(recibirIni, recibirFin);
assert.ok(recibirTxt.indexOf('validarRecepcionPedidoPM10') >= 0);
assert.ok(recibirTxt.indexOf('validarRecepcionPedidoPM10') < recibirTxt.indexOf('procesarRecepcion({'), 'valida antes de mutar stock');
assert.doesNotMatch(recibirTxt, /lineas\.filter\(\(ln2\) => Number\(ln2\.cantidad\) > 0\)/);
assert.match(recibirTxt, /aplicarRecepcionPedidoPM10/);

const albaranIni = src.indexOf('function crearLogicaAlbaranes({');
const albaranFin = src.indexOf('function crearLogicaRespaldos', albaranIni);
assert.ok(albaranIni >= 0 && albaranFin > albaranIni);
const albaranTxt = src.slice(albaranIni, albaranFin);
assert.match(albaranTxt.slice(0, 900), /\bpedidos\b/);
const confirmarIni = albaranTxt.indexOf('function confirmarAlbaran(');
const confirmarFin = albaranTxt.indexOf('function anularAlbaran(', confirmarIni);
const confirmarTxt = albaranTxt.slice(confirmarIni, confirmarFin);
assert.match(confirmarTxt, /\(pedidos \|\| \[\]\)\.find/);
assert.ok(confirmarTxt.indexOf('validarRecepcionPedidoPM10') < confirmarTxt.indexOf('procesarRecepcion({'), 'albarán ligado valida antes de entrada');
assert.match(confirmarTxt, /aplicarRecepcionPedidoPM10/);

const callPos = src.indexOf('const { buscarEnCatalogo');
const callEnd = src.indexOf('});', callPos);
const callTxt = src.slice(callPos, callEnd + 3);
assert.match(callTxt, /pedidos: pedidos2/);

const recepcionIni = src.indexOf('function Recepcion({');
const recepcionFin = src.indexOf('function textoHojaConteo(', recepcionIni);
const recepcionTxt = src.slice(recepcionIni, recepcionFin);
assert.match(recepcionTxt, /erroresRecepcion/);
assert.match(recepcionTxt, /const porProducto = new Map\(\)/);
assert.match(recepcionTxt, /const resultado = recibirPedido/);
assert.match(recepcionTxt, /if \(!resultado \|\| resultado\.ok === false\)[\s\S]{0,300}setErroresRecepcion/);
assert.ok(recepcionTxt.indexOf('resultado.ok === false') < recepcionTxt.indexOf('setActivos((s22)'), 'no limpia captura antes de comprobar éxito');

const darIni = src.indexOf('function darEntrada() {');
const darFin = src.indexOf('if (modo === "lista")', darIni);
const darTxt = src.slice(darIni, darFin);
assert.match(darTxt, /const pobladas =/);
assert.match(darTxt, /const candidatas = alb\.pedidoId \? pobladas : validas/);
assert.match(darTxt, /const resultado = confirmarAlbaran\(limpio\)/);
assert.match(darTxt, /resultado && resultado\.ok === false/);
assert.ok(darTxt.indexOf('resultado && resultado.ok === false') < darTxt.indexOf('setModo("lista")'), 'albarán ligado conserva editor ante error');

console.log('PM10 P06 LA-013 Recepción: contrato OK');
