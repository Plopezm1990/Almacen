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
    const { venderLote, devolverLote } = crearLogicaVenta({ productos: estadoProductos, setProductos, movimientos: estadoMovimientos, setMovimientos, arqueos: [], localActivoId: localActivo });
    return crearLogicaEncargos({
      encargos: estadoEncargos,
      setEncargos,
      registrarAuditoria: () => {},
      productos: estadoProductos,
      clientes,
      setProductos,
      setMovimientos,
      venderLote,
      devolverLote,
      localActivoId: localActivo,
      empresaId,
      locales
    });
  }

  return {
    devolver: (encargoOrId, opts, localActivo = localActivoId) => construirLogica(localActivo).devolverEncargo(encargoOrId, opts),
    productos: () => estadoProductos,
    movimientos: () => estadoMovimientos,
    encargos: () => estadoEncargos
  };
}

function encargoEntregado(overrides = {}) {
  return {
    id: 'enc-1', estado: 'Entregado', clienteId: 'c1', localId: 'L1', empresaId: 'E1',
    fechaCreacion: '2026-09-01', fechaEntrega: '2026-09-05', fechaEntregaReal: '2026-09-05',
    total: 20, señal: 5, señalMedioPago: 'Tarjeta',
    cobros: [
      { id: 'cobro-senal', concepto: 'Señal', importe: 5, medioPago: 'Tarjeta', fecha: '2026-09-01' },
      { id: 'resto-entrega:enc-1', concepto: 'Resto entrega', importe: 15, medioPago: 'Efectivo', fecha: '2026-09-05' }
    ],
    lineas: [{ productoId: 'p1', descripcion: 'Tarta', cantidad: 2, precioUnitario: 10 }],
    ...overrides
  };
}

const productosBase = [{ id: 'p1', nombre: 'Tarta', localId: 'L1', empresaId: 'E1', precioVenta: 12, stock: 8, stockPisoVenta: 8 }];

// ---- Caso feliz: devuelve stock, marca Devuelto, calcula qué reembolsar. ----
let m = mundo({ productos: productosBase, encargosIniciales: [encargoEntregado()] });
let r = m.devolver('enc-1', { motivo: 'El cliente no quedó satisfecho' });
assert.equal(r.ok, true, JSON.stringify(r));
assert.equal(m.productos()[0].stock, 10, 'las 2 unidades vuelven al stock');
assert.equal(m.encargos()[0].estado, 'Devuelto');
assert.equal(m.encargos()[0].motivoDevolucion, 'El cliente no quedó satisfecho');
assert.equal(m.encargos()[0].fechaDevolucion, '2026-09-08');
assert.equal(r.cobrosParaReembolsar.length, 2, 'señal y resto, ambos a resolver');
assert.equal(r.cobrosParaReembolsar.map((c) => c.sufijo).sort().join(','), 'resto,senal');
assert.equal(m.movimientos().length, 1);
assert.equal(m.movimientos()[0].tipo, 'DEVOLUCION_ENCARGO');
console.log('P05_DEVOLUCION_FELIZ_OK=PASS');

// ---- Replay/doble clic: devolver dos veces no duplica stock ni falla. ----
m = mundo({ productos: productosBase, encargosIniciales: [encargoEntregado()] });
r = m.devolver('enc-1', { motivo: 'Motivo' });
assert.equal(r.ok, true);
const stockTrasPrimera = m.productos()[0].stock;
r = m.devolver('enc-1', { motivo: 'Motivo repetido' });
assert.equal(r.ok, true, JSON.stringify(r));
assert.equal(r.yaDevuelto, true);
assert.equal(m.productos()[0].stock, stockTrasPrimera, 'no debe volver a sumar stock');
assert.equal(m.movimientos().length, 1, 'no debe crear un segundo movimiento');
console.log('P05_REPLAY_IDEMPOTENTE=PASS');

// ---- No se puede devolver algo que no está entregado. ----
m = mundo({ productos: productosBase, encargosIniciales: [encargoEntregado({ estado: 'Pendiente' })] });
r = m.devolver('enc-1', { motivo: 'x' });
assert.equal(r.ok, false);
assert.equal(r.codigo, 'estado_no_permitido');
assert.equal(m.productos()[0].stock, 8, 'no debe tocar stock');

m = mundo({ productos: productosBase, encargosIniciales: [encargoEntregado({ estado: 'Cancelado' })] });
r = m.devolver('enc-1', { motivo: 'x' });
assert.equal(r.ok, false);
assert.equal(r.codigo, 'estado_no_permitido');
console.log('P05_SOLO_DEVUELVE_ENTREGADO=PASS');

// ---- Motivo obligatorio. ----
m = mundo({ productos: productosBase, encargosIniciales: [encargoEntregado()] });
r = m.devolver('enc-1', { motivo: '   ' });
assert.equal(r.ok, false);
assert.equal(r.codigo, 'motivo_requerido');
assert.equal(m.encargos()[0].estado, 'Entregado');
assert.equal(m.productos()[0].stock, 8);
console.log('P05_MOTIVO_OBLIGATORIO=PASS');

// ---- Cross-local: no se puede devolver un encargo de otro local. ----
m = mundo({ productos: productosBase, encargosIniciales: [encargoEntregado({ localId: 'L2' })] });
r = m.devolver('enc-1', { motivo: 'x' }, 'L1');
assert.equal(r.ok, false);
assert.equal(r.codigo, 'contexto_no_autorizado');
assert.equal(m.productos()[0].stock, 8);
console.log('P05_OTRO_LOCAL_RECHAZADO=PASS');

// ---- Inexistente. ----
m = mundo({ productos: productosBase, encargosIniciales: [] });
r = m.devolver('no-existe', { motivo: 'x' });
assert.equal(r.ok, false);
assert.equal(r.codigo, 'referencia_inexistente');
console.log('P05_INEXISTENTE_RECHAZADO=PASS');

// ---- Acepta el objeto completo, igual que entregarEncargo/cancelarEncargo. ----
m = mundo({ productos: productosBase, encargosIniciales: [encargoEntregado()] });
r = m.devolver(encargoEntregado(), { motivo: 'Objeto completo' });
assert.equal(r.ok, true, JSON.stringify(r));
console.log('P05_ACEPTA_OBJETO_COMPLETO=PASS');

// ---- Solo señal cobrada (sin resto pendiente de cobrar): solo un reembolso a resolver. ----
m = mundo({ productos: productosBase, encargosIniciales: [encargoEntregado({ total: 5, señal: 5, cobros: [{ id: 'cobro-senal', concepto: 'Señal', importe: 5, medioPago: 'Tarjeta', fecha: '2026-09-01' }] })] });
r = m.devolver('enc-1', { motivo: 'x' });
assert.equal(r.ok, true, JSON.stringify(r));
assert.equal(r.cobrosParaReembolsar.length, 1);
assert.equal(r.cobrosParaReembolsar[0].sufijo, 'senal');
console.log('P05_SOLO_SEÑAL_A_REEMBOLSAR=PASS');

// ---- Líneas manuales (sin producto de catálogo) no tocan stock al devolver. ----
m = mundo({
  productos: productosBase,
  encargosIniciales: [encargoEntregado({ lineas: [{ productoId: '', descripcion: 'Tarta personalizada', cantidad: 1, precioUnitario: 20 }] })]
});
r = m.devolver('enc-1', { motivo: 'x' });
assert.equal(r.ok, true, JSON.stringify(r));
assert.equal(m.movimientos().length, 0, 'sin producto de catálogo no hay movimiento de stock que devolver');
assert.equal(m.productos()[0].stock, 8);
console.log('P05_LINEAS_MANUALES_SIN_STOCK=PASS');

console.log('PM14 P05 Encargos — devolución de lo entregado, trazable e idempotente: contrato OK');
