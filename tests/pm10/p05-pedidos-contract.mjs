import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');

const p04Ini = src.indexOf('function errorValidacionPM10');
const p04Fin = src.indexOf('function crearLogicaProductos', p04Ini);
const p05Ini = src.indexOf('function fechaValidaPedidoPM10');
const p05Logic = src.indexOf('function crearLogicaPedidos', p05Ini);
const p05Fin = src.indexOf('function crearLogicaFichasCosto', p05Logic);
assert.ok(p04Ini >= 0 && p04Fin > p04Ini, 'helpers numéricos PM10 disponibles');
assert.ok(p05Ini >= 0 && p05Logic > p05Ini && p05Fin > p05Logic, 'helpers/lógica LA-012 disponibles');

const ctx = {
  uid: (() => { let n = 0; return () => `id-${++n}`; })(),
  todayISO: () => '2026-09-05'
};
vm.createContext(ctx);
vm.runInContext(src.slice(p04Ini, p04Fin), ctx);
vm.runInContext(src.slice(p05Ini, p05Logic), ctx);
vm.runInContext(src.slice(p05Logic, p05Fin), ctx);

const validar = ctx.validarPedidoPM10;
const crearLogica = ctx.crearLogicaPedidos;
assert.equal(typeof validar, 'function');
assert.equal(typeof crearLogica, 'function');

const proveedores = [{ id: 'prov-1', nombre: 'Proveedor QA' }];
const productos = [
  { id: 'p1', localId: 'L1', nombre: 'Uno' },
  { id: 'p2', localId: 'L1', nombre: 'Dos' },
  { id: 'p3', localId: 'L1', nombre: 'Tres' },
  { id: 'p-otro', localId: 'L2', nombre: 'Otro local' }
];
const opciones = { proveedores, productos, localActivoId: 'L1' };

function fallo(data, campo, codigo, extra = {}) {
  const r = validar(data, { ...opciones, ...extra });
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.campo, campo, JSON.stringify(r));
  assert.equal(r.codigo, codigo, JSON.stringify(r));
  return r;
}

const base = { proveedorId: 'prov-1', fechaEsperada: '2026-09-30', items: [{ productoId: 'p1', cantidad: 2, costoUnitario: 3.25 }] };
let r = validar(base, opciones);
assert.equal(r.ok, true);
assert.equal(r.datos.items[0].cantidadRecibida, 0);
assert.equal(r.datos.items[0].cantidad, 2);
assert.equal(r.datos.items[0].costoUnitario, 3.25);

fallo({ ...base, proveedorId: '' }, 'proveedorId', 'campo_obligatorio');
fallo({ ...base, proveedorId: 'no-existe' }, 'proveedorId', 'referencia_inexistente');
fallo({ ...base, items: [] }, 'items', 'campo_obligatorio');
fallo({ ...base, items: [{ productoId: '', cantidad: 1, costoUnitario: 1 }] }, 'items.0.productoId', 'campo_obligatorio');
fallo({ ...base, items: [{ productoId: 'no-existe', cantidad: 1, costoUnitario: 1 }] }, 'items.0.productoId', 'referencia_inexistente');
fallo({ ...base, items: [{ productoId: 'p-otro', cantidad: 1, costoUnitario: 1 }] }, 'items.0.productoId', 'referencia_otro_contexto');
fallo({ ...base, items: [{ productoId: 'p1', cantidad: 0, costoUnitario: 1 }] }, 'items.0.cantidad', 'valor_fuera_rango');
fallo({ ...base, items: [{ productoId: 'p1', cantidad: -1, costoUnitario: 1 }] }, 'items.0.cantidad', 'valor_fuera_rango');
fallo({ ...base, items: [{ productoId: 'p1', cantidad: 'abc', costoUnitario: 1 }] }, 'items.0.cantidad', 'numero_no_finito');
fallo({ ...base, items: [{ productoId: 'p1', cantidad: Infinity, costoUnitario: 1 }] }, 'items.0.cantidad', 'numero_no_finito');
fallo({ ...base, items: [{ productoId: 'p1', cantidad: 1, costoUnitario: -0.01 }] }, 'items.0.costoUnitario', 'valor_fuera_rango');
fallo({ ...base, items: [{ productoId: 'p1', cantidad: 1, costoUnitario: 'abc' }] }, 'items.0.costoUnitario', 'numero_no_finito');
fallo({ ...base, items: [{ productoId: 'p1', cantidad: 1, costoUnitario: NaN }] }, 'items.0.costoUnitario', 'numero_no_finito');
fallo({ ...base, fechaEsperada: '2026-02-29' }, 'fechaEsperada', 'fecha_invalida');
fallo({ ...base, fechaEsperada: '30/09/2026' }, 'fechaEsperada', 'fecha_invalida');
fallo({ ...base }, 'localId', 'contexto_no_autorizado', { localActivoId: null });

r = validar({ ...base, fechaEsperada: '', items: [{ productoId: 'p1', cantidad: 0.5, costoUnitario: 0 }, { productoId: 'p2', cantidad: 1e300, costoUnitario: 1e200 }] }, opciones);
assert.equal(r.ok, true, JSON.stringify(r));
r = validar({ ...base, fechaEsperada: '2028-02-29' }, opciones);
assert.equal(r.ok, true);

// Todo o nada: una sola línea inválida invalida el pedido completo.
fallo({ ...base, items: [{ productoId: 'p1', cantidad: 1, costoUnitario: 1 }, { productoId: 'p2', cantidad: 0, costoUnitario: 1 }] }, 'items.1.cantidad', 'valor_fuera_rango');

const parcial = {
  id: 'ped-1', localId: 'L1', proveedorId: 'prov-1', fechaEsperada: '2026-09-30', estado: 'Parcial',
  items: [
    { productoId: 'p1', cantidad: 5, costoUnitario: 3, cantidadRecibida: 3 },
    { productoId: 'p2', cantidad: 2, costoUnitario: 4, cantidadRecibida: 0 }
  ]
};

r = validar({ proveedorId: 'prov-1', fechaEsperada: '2026-10-01', items: [
  { productoId: 'p1', cantidad: 5, costoUnitario: 3, cantidadRecibida: 3 },
  { productoId: 'p3', cantidad: 2, costoUnitario: 5 }
] }, { ...opciones, pedidoActual: parcial });
assert.equal(r.ok, true, JSON.stringify(r));
assert.equal(r.datos.items[0].cantidadRecibida, 3, 'conserva recepción de línea existente');
assert.equal(r.datos.items[1].cantidadRecibida, 0, 'línea nueva empieza en cero');

fallo({ proveedorId: 'prov-1', fechaEsperada: '', items: [{ productoId: 'p1', cantidad: 2, costoUnitario: 3, cantidadRecibida: 3 }] }, 'items.0.cantidad', 'exceso_sobre_cantidad_pendiente', { pedidoActual: parcial });
fallo({ proveedorId: 'prov-1', fechaEsperada: '', items: [{ productoId: 'p2', cantidad: 2, costoUnitario: 4 }] }, 'items', 'conflicto_estado_previo', { pedidoActual: parcial });
fallo({ proveedorId: 'prov-1', fechaEsperada: '', items: [{ productoId: 'p1', cantidad: 5, costoUnitario: 3, cantidadRecibida: 0 }] }, 'items.0.cantidadRecibida', 'conflicto_estado_previo', { pedidoActual: parcial });
fallo({ proveedorId: 'prov-1', fechaEsperada: '', items: [{ productoId: 'p1', cantidad: 5, costoUnitario: 3, cantidadRecibida: 4 }] }, 'items.0.cantidadRecibida', 'conflicto_estado_previo', { pedidoActual: parcial });
fallo({ proveedorId: 'prov-1', fechaEsperada: '', items: [{ productoId: 'p1', cantidad: 5, costoUnitario: 3, cantidadRecibida: 3 }, { productoId: 'p3', cantidad: 1, costoUnitario: 1, cantidadRecibida: 1 }] }, 'items.1.cantidadRecibida', 'conflicto_estado_previo', { pedidoActual: parcial });

function construirLogica(pedidosIniciales) {
  let estado = structuredClone(pedidosIniciales);
  let mutaciones = 0;
  const setPedidos = (fn) => { mutaciones += 1; estado = fn(estado); };
  const logica = crearLogica({
    pedidos: pedidosIniciales,
    setPedidos,
    productos,
    proveedores,
    setProductos: () => {},
    setMovimientos: () => {},
    almacenCongelado: false,
    procesarRecepcion: () => ({ lineasResueltas: [], avisos: [] }),
    localActivoId: 'L1'
  });
  return { logica, estado: () => estado, mutaciones: () => mutaciones };
}

// Dominio: un alta inválida no muta y la válida inmediatamente posterior sí funciona.
let h = construirLogica([]);
let creado = h.logica.crearPedido({ ...base, items: [{ productoId: 'p1', cantidad: 'mal', costoUnitario: 1 }] });
assert.equal(creado.ok, false);
assert.equal(h.mutaciones(), 0);
creado = h.logica.crearPedido({ ...base, items: [{ productoId: 'p1', cantidad: '2.5', costoUnitario: '3.5' }] });
assert.ok(creado.id);
assert.equal(h.mutaciones(), 1);
assert.equal(h.estado()[0].items[0].cantidad, 2.5);
assert.equal(h.estado()[0].items[0].costoUnitario, 3.5);
assert.equal(h.estado()[0].items[0].cantidadRecibida, 0);

// Dominio: edición parcial inválida no muta; válida conserva cantidadRecibida.
h = construirLogica([parcial]);
let actualizado = h.logica.actualizarPedido('ped-1', { proveedorId: 'prov-1', fechaEsperada: '', items: [{ productoId: 'p1', cantidad: 2, costoUnitario: 3, cantidadRecibida: 3 }] });
assert.equal(actualizado.ok, false);
assert.equal(h.mutaciones(), 0);
actualizado = h.logica.actualizarPedido('ped-1', { proveedorId: 'prov-1', fechaEsperada: '2026-10-01', items: [{ productoId: 'p1', cantidad: 6, costoUnitario: 3, cantidadRecibida: 3 }, { productoId: 'p3', cantidad: 2, costoUnitario: 5 }] });
assert.equal(actualizado, true);
assert.equal(h.mutaciones(), 1);
assert.equal(h.estado()[0].items[0].cantidadRecibida, 3);
assert.equal(h.estado()[0].items[1].cantidadRecibida, 0);

// Evidencia estática de la ruta UI: conserva recepción y deja al dominio validar sin degradar valores.
const uiIni = src.indexOf('function Pedidos({');
const uiFin = src.indexOf('function RecepcionPedido', uiIni) > uiIni ? src.indexOf('function RecepcionPedido', uiIni) : Math.min(src.length, uiIni + 90000);
const ui = src.slice(uiIni, uiFin);
assert.match(ui, /cantidadRecibida: it2\.cantidadRecibida \?\? 0/);
assert.match(ui, /const payload = \{ proveedorId, fechaEsperada, items \};/);
assert.match(ui, /if \(!resultado \|\| resultado\.ok === false\)[\s\S]{0,180}setError/);
assert.match(ui, /if \(!pedido \|\| pedido\.ok === false\)[\s\S]{0,180}setError/);
assert.doesNotMatch(ui, /const itemsLimpios = items\.map/);

const logicaTxt = src.slice(p05Logic, p05Fin);
assert.match(logicaTxt, /function crearLogicaPedidos\(\{[^}]*proveedores/);
assert.match(logicaTxt, /function crearPedido\(data\)[\s\S]{0,250}validarPedidoPM10/);
assert.match(logicaTxt, /function actualizarPedido\(pedidoId, data\)[\s\S]{0,500}validarPedidoPM10/);
assert.doesNotMatch(logicaTxt, /items: items\.map\(\(it2\) => \(\{ \.\.\.it2, cantidadRecibida: 0 \}\)\)/);

console.log('PM10 P05 LA-012 Pedidos: contrato OK');
