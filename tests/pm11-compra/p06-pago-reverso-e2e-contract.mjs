import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');

function extraerFuncion(nombre) {
  const firma = `function ${nombre}(`;
  const firmaIni = src.indexOf(firma);
  assert.ok(firmaIni >= 0, `${nombre} presente`);
  const asyncIni = firmaIni >= 6 && src.slice(firmaIni - 6, firmaIni) === 'async ' ? firmaIni - 6 : firmaIni;
  const llave = src.indexOf('{', firmaIni);
  let nivel = 0;
  let quote = null;
  let escape = false;
  for (let i = llave; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') nivel++;
    if (c === '}') {
      nivel--;
      if (nivel === 0) return src.slice(asyncIni, i + 1);
    }
  }
  throw new Error(`No se pudo extraer ${nombre}`);
}

const nombres = [
  'redondearDineroPM06',
  'normalizarPagoPM06',
  'calcularSaldoFacturaPM06',
  'modoSincronizadoPM06',
  'claveOperacionPM06',
  'leerPendientePM06',
  'guardarPendientePM06',
  'limpiarPendientePM06',
  'registrarPagoPM06',
  'revertirUltimoPagoPM06'
];

let seq = 0;
const memoria = new Map();
const ctx = {
  console,
  Math,
  Number,
  JSON,
  Date,
  Promise,
  setTimeout,
  clearTimeout,
  window: { __modoPruebasLocal: true },
  localStorage: {
    getItem: (k) => memoria.has(k) ? memoria.get(k) : null,
    setItem: (k, v) => memoria.set(k, String(v)),
    removeItem: (k) => memoria.delete(k)
  },
  todayISO: () => '2026-09-07',
  uid: () => `p06-${++seq}`
};
vm.createContext(ctx);
vm.runInContext(nombres.map(extraerFuncion).join('\n') + '\nvar pagosPM06EnCurso = {};', ctx);

const factura = {
  id: 'alb-p06-1',
  empresaId: 'EMP-A',
  localId: 'LOC-A',
  proveedorId: 'PROV-A',
  esFactura: true,
  estado: 'confirmado',
  numeroFactura: 'FAC-006',
  fechaFactura: '2026-09-07',
  total: 100,
  pagada: false
};
let pagos = [];
const setPagos = (updater) => { pagos = typeof updater === 'function' ? updater(pagos) : updater; };

// 1) Pago parcial: 40 -> pendiente 60.
let r = await ctx.registrarPagoPM06({ factura, origenFactura: 'albaran', importe: 40, pagosFacturas: pagos, setPagosFacturas: setPagos });
assert.equal(r.ok, true);
assert.equal(r.replayed, false);
assert.equal(pagos.length, 1);
assert.equal(pagos[0].facturaId, factura.id);
assert.equal(pagos[0].origenFactura, 'albaran');
assert.equal(pagos[0].empresaId, 'EMP-A');
assert.equal(pagos[0].localId, 'LOC-A');
let saldo = ctx.calcularSaldoFacturaPM06(pagos, factura.id, 'albaran', 100, 'EMP-A', 'LOC-A', false);
assert.equal(saldo.pagado, 40);
assert.equal(saldo.pendiente, 60);
assert.equal(saldo.pagada, false);

// 2) Sobrepago se rechaza antes de generar movimiento.
r = await ctx.registrarPagoPM06({ factura, origenFactura: 'albaran', importe: 61, pagosFacturas: pagos, setPagosFacturas: setPagos });
assert.equal(r.ok, false);
assert.match(r.error, /supera el saldo pendiente/i);
assert.equal(pagos.length, 1);

// 3) Pago final exacto: 60 -> saldo 0, pagada.
r = await ctx.registrarPagoPM06({ factura, origenFactura: 'albaran', importe: 60, pagosFacturas: pagos, setPagosFacturas: setPagos });
assert.equal(r.ok, true);
assert.equal(pagos.length, 2);
saldo = ctx.calcularSaldoFacturaPM06(pagos, factura.id, 'albaran', 100, 'EMP-A', 'LOC-A', false);
assert.equal(saldo.pagado, 100);
assert.equal(saldo.pendiente, 0);
assert.equal(saldo.pagada, true);

// 4) No se admite otro pago cuando saldo=0.
r = await ctx.registrarPagoPM06({ factura, origenFactura: 'albaran', importe: 1, pagosFacturas: pagos, setPagosFacturas: setPagos });
assert.equal(r.ok, false);
assert.equal(pagos.length, 2);

// 5) Reverso del último pago exacto: revierte 60, vuelve pendiente 60.
r = await ctx.revertirUltimoPagoPM06({ factura, origenFactura: 'albaran', pagosFacturas: pagos, setPagosFacturas: setPagos, motivo: 'QA P06' });
assert.equal(r.ok, true);
assert.equal(pagos.length, 3);
assert.equal(pagos[2].estado, 'REVERSO');
assert.equal(pagos[2].reviertePagoId, pagos[1].id);
saldo = ctx.calcularSaldoFacturaPM06(pagos, factura.id, 'albaran', 100, 'EMP-A', 'LOC-A', false);
assert.equal(saldo.pagado, 40);
assert.equal(saldo.pendiente, 60);
assert.equal(saldo.pagada, false);

// 6) Aislamiento por origen/contexto: pagos de otro local no contaminan saldo.
const ajeno = { ...pagos[0], id: 'ajeno', operationId: 'ajeno-op', facturaId: factura.id, localId: 'LOC-B', importe: 999 };
saldo = ctx.calcularSaldoFacturaPM06([...pagos, ajeno], factura.id, 'albaran', 100, 'EMP-A', 'LOC-A', false);
assert.equal(saldo.pagado, 40);
assert.equal(saldo.pendiente, 60);

// 7) P05 sigue cerrando el acceso al ledger desde albarán simple/ambiguo.
const albIni = src.indexOf('function crearLogicaAlbaranes({');
const marcarIni = src.indexOf('  async function marcarPagada(', albIni);
const procesarIni = src.indexOf('  function procesarRecepcion({', marcarIni);
assert.ok(marcarIni >= 0 && procesarIni > marcarIni);
const marcar = src.slice(marcarIni, procesarIni);
assert.match(marcar, /estado !== "confirmado"/);
assert.match(marcar, /validarIdentidadFacturaAlbaranPM11/);
assert.match(marcar, /exigirFactura: true/);
assert.match(marcar, /registrarPagoPM06/);
assert.match(marcar, /revertirUltimoPagoPM06/);
assert.match(marcar, /origenFactura: "albaran"/);

console.log('PM11_COMPRA_P06_PAGO_REVERSO_E2E=PASS');
