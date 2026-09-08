import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');

function slice(startMarker, endMarker) {
  const ini = src.indexOf(startMarker);
  assert.ok(ini >= 0, `marcador no encontrado: ${startMarker}`);
  const fin = src.indexOf(endMarker, ini);
  assert.ok(fin > ini, `marcador de fin no encontrado tras ${startMarker}: ${endMarker}`);
  return src.slice(ini, fin);
}

const comunPM10 = slice('function errorValidacionPM10', 'function crearLogicaProductos');
const motorStock = slice('function crearMotorStock({', 'function errorValidacionPM10');
const encargos = slice('function validarEncargoPM10(', 'function crearLogicaVenta({');
const venta = slice('function crearLogicaVenta({', 'function crearLogicaTraspasos({');

const ctx = {
  todayISO: () => '2026-09-08',
  uid: (() => { let n = 0; return () => `uid-${++n}`; })(),
  ivaDe: () => 10,
  precioNeto: (p) => (Number(p && p.precioVenta) || 0) / 1.1,
  sincronizarCobroSeñal: (existentes = [], señal = 0, medio = 'Efectivo', fecha = '2026-09-08') => {
    const resto = (existentes || []).filter((x) => x && x.concepto !== 'Señal');
    const n = Number(señal);
    return n > 0 ? [{ id: 'cobro-senal', concepto: 'Señal', importe: n, medioPago: medio, fecha }, ...resto] : resto;
  }
};
vm.createContext(ctx);
vm.runInContext(motorStock + '\n' + comunPM10 + '\n' + venta + '\n' + encargos, ctx);

const crearLogicaVenta = ctx.crearLogicaVenta;
const crearLogicaEncargos = ctx.crearLogicaEncargos;
assert.equal(typeof crearLogicaVenta, 'function');
assert.equal(typeof crearLogicaEncargos, 'function');

function mundo({ productos, encargosIniciales = [], localActivoId = 'L1', empresaId = 'E1' }) {
  let estadoProductos = structuredClone(productos);
  let estadoMovimientos = [];
  let estadoEncargos = structuredClone(encargosIniciales);
  const setProductos = (fn) => { estadoProductos = fn(estadoProductos); };
  const setMovimientos = (fn) => { estadoMovimientos = fn(estadoMovimientos); };
  const setEncargos = (fn) => { estadoEncargos = fn(estadoEncargos); };
  const clientes = [{ id: 'c1', nombre: 'Cliente A', empresaId: 'E1' }];
  const locales = [{ id: 'L1', empresaId: 'E1', activo: true }, { id: 'L2', empresaId: 'E1', activo: true }];

  function construirLogica(localActivo) {
    const { venderLote } = crearLogicaVenta({ productos: estadoProductos, setProductos, movimientos: estadoMovimientos, setMovimientos, arqueos: [], localActivoId: localActivo });
    return crearLogicaEncargos({
      encargos: estadoEncargos,
      setEncargos,
      registrarAuditoria: () => {},
      productos: estadoProductos,
      clientes,
      setProductos,
      setMovimientos,
      venderLote,
      localActivoId: localActivo,
      empresaId,
      locales
    });
  }

  return {
    entregar: (encargoOrId, medioPago, localActivo = localActivoId) => construirLogica(localActivo).entregarEncargo(encargoOrId, medioPago),
    eliminar: (id, localActivo = localActivoId) => construirLogica(localActivo).deleteEncargo(id),
    productos: () => estadoProductos,
    movimientos: () => estadoMovimientos,
    encargos: () => estadoEncargos
  };
}

function encargoBase(overrides = {}) {
  return {
    id: 'enc-1',
    estado: 'Pendiente',
    clienteId: 'c1',
    localId: 'L1',
    empresaId: 'E1',
    fechaCreacion: '2026-09-01',
    fechaEntrega: '2026-09-08',
    señal: 5,
    señalMedioPago: 'Tarjeta',
    cobros: [{ id: 'cobro-senal', concepto: 'Señal', importe: 5, medioPago: 'Tarjeta', fecha: '2026-09-01' }],
    total: 20,
    lineas: [{ productoId: 'p1', descripcion: 'Tarta', cantidad: 2, precioUnitario: 10 }],
    ...overrides
  };
}

const productosBase = [{ id: 'p1', nombre: 'Tarta', localId: 'L1', empresaId: 'E1', precioVenta: 12, stock: 10, stockPisoVenta: 10 }];

// ---- Caso positivo: entrega descuenta stock, marca Entregado y liquida el resto. ----
let m = mundo({ productos: productosBase, encargosIniciales: [encargoBase()] });
let r = m.entregar('enc-1', 'Efectivo');
assert.equal(r.ok, true, JSON.stringify(r));
assert.equal(m.productos()[0].stock, 8, 'debe descontar 2 unidades de stock');
assert.equal(m.encargos()[0].estado, 'Entregado');
assert.equal(m.encargos()[0].fechaEntregaReal, '2026-09-08');
const cobroResto = m.encargos()[0].cobros.find((c) => c.concepto === 'Resto entrega');
assert.ok(cobroResto, 'debe añadir el cobro del resto');
assert.equal(cobroResto.importe, 15, 'resto = total(20) - señal(5)');
assert.equal(m.movimientos().length, 1);
assert.equal(m.movimientos()[0].documentoOrigenId, 'enc-1');
assert.equal(m.movimientos()[0].encargoId, 'enc-1');

// ---- Replay/doble clic: repetir la misma entrega no debe duplicar stock ni venta. ----
m = mundo({ productos: productosBase, encargosIniciales: [encargoBase()] });
r = m.entregar('enc-1', 'Efectivo');
assert.equal(r.ok, true);
const stockTrasPrimera = m.productos()[0].stock;
const movsTrasPrimera = m.movimientos().length;
r = m.entregar('enc-1', 'Efectivo');
assert.equal(r.ok, true, JSON.stringify(r));
assert.equal(r.yaEntregado, true, 'segunda llamada debe reconocerse como ya entregado');
assert.equal(m.productos()[0].stock, stockTrasPrimera, 'no debe volver a descontar stock');
assert.equal(m.movimientos().length, movsTrasPrimera, 'no debe crear un segundo movimiento');

// ---- El identificador roto de origen (pasar el objeto completo) queda cubierto igual que pasar el id. ----
m = mundo({ productos: productosBase, encargosIniciales: [encargoBase()] });
r = m.entregar(encargoBase(), 'Efectivo'); // la UI real pasa el objeto completo
assert.equal(r.ok, true, JSON.stringify(r));
assert.equal(m.encargos()[0].estado, 'Entregado');

// ---- Caso negativo: sin local activo ("Todos los locales") no se puede entregar. ----
m = mundo({ productos: productosBase, encargosIniciales: [encargoBase()] });
r = m.entregar('enc-1', 'Efectivo', null);
assert.equal(r.ok, false);
assert.equal(m.encargos()[0].estado, 'Pendiente', 'no debe mutar nada sin local activo');
assert.equal(m.productos()[0].stock, 10);

// ---- Caso negativo: encargo de otro local. ----
m = mundo({ productos: productosBase, encargosIniciales: [encargoBase({ localId: 'L2' })] });
r = m.entregar('enc-1', 'Efectivo', 'L1');
assert.equal(r.ok, false);
assert.equal(m.encargos()[0].estado, 'Pendiente');
assert.equal(m.productos()[0].stock, 10);

// ---- Caso negativo: encargo inexistente. ----
m = mundo({ productos: productosBase, encargosIniciales: [] });
r = m.entregar('no-existe', 'Efectivo');
assert.equal(r.ok, false);

// ---- Caso negativo: stock insuficiente bloquea TODA la entrega (atómico), no solo la línea que falla. ----
const productosDosLineas = [
  { id: 'p1', nombre: 'Tarta', localId: 'L1', empresaId: 'E1', precioVenta: 12, stock: 10, stockPisoVenta: 10 },
  { id: 'p2', nombre: 'Café', localId: 'L1', empresaId: 'E1', precioVenta: 2, stock: 1, stockPisoVenta: 1 }
];
const encargoDosLineas = encargoBase({
  total: 40,
  lineas: [
    { productoId: 'p1', descripcion: 'Tarta', cantidad: 2, precioUnitario: 10 },
    { productoId: 'p2', descripcion: 'Café', cantidad: 5, precioUnitario: 2 }
  ]
});
m = mundo({ productos: productosDosLineas, encargosIniciales: [encargoDosLineas] });
r = m.entregar('enc-1', 'Efectivo');
assert.equal(r.ok, false, JSON.stringify(r));
assert.equal(m.productos()[0].stock, 10, 'la primera línea no debe quedar aplicada si la segunda falla');
assert.equal(m.productos()[1].stock, 1);
assert.equal(m.movimientos().length, 0, 'ningún movimiento debe quedar registrado');
assert.equal(m.encargos()[0].estado, 'Pendiente', 'el encargo no puede quedar marcado Entregado sin stock real');

// ---- Líneas escritas a mano (sin productoId) no tocan stock pero sí se liquidan en el resto. ----
const encargoManual = encargoBase({
  total: 20,
  lineas: [{ productoId: '', descripcion: 'Tarta personalizada', cantidad: 1, precioUnitario: 20 }]
});
m = mundo({ productos: productosBase, encargosIniciales: [encargoManual] });
r = m.entregar('enc-1', 'Efectivo');
assert.equal(r.ok, true, JSON.stringify(r));
assert.equal(m.movimientos().length, 0, 'una línea sin producto de catálogo no genera movimiento de stock');
assert.equal(m.productos()[0].stock, 10);
assert.equal(m.encargos()[0].estado, 'Entregado');

// ---- No se puede entregar dos veces un encargo ya Cancelado/otro estado no-Pendiente. ----
m = mundo({ productos: productosBase, encargosIniciales: [encargoBase({ estado: 'Cancelado' })] });
r = m.entregar('enc-1', 'Efectivo');
assert.equal(r.ok, false);
assert.equal(m.movimientos().length, 0);

// ---- deleteEncargo ya no permite borrar un encargo Entregado (no deja referencias colgantes). ----
m = mundo({ productos: productosBase, encargosIniciales: [encargoBase({ estado: 'Entregado' })] });
let eliminado = m.eliminar('enc-1');
assert.equal(eliminado, false, 'un encargo ya entregado no debe poder borrarse físicamente');
assert.equal(m.encargos().length, 1);

// ---- deleteEncargo sigue bloqueado en "Todos los locales" (no debe ser destino de una mutación). ----
m = mundo({ productos: productosBase, encargosIniciales: [encargoBase()] });
eliminado = m.eliminar('enc-1', null);
assert.equal(eliminado, false, '"Todos los locales" no puede ser destino de un borrado');
assert.equal(m.encargos().length, 1);

console.log('PM14 P03 Encargos — entrega atómica, idempotente y con local real: contrato OK');
