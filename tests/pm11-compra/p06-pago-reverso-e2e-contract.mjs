import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');

function bloqueEntre(inicio, fin) {
  const a = src.indexOf(inicio);
  const b = src.indexOf(fin, a + inicio.length);
  assert.ok(a >= 0 && b > a, `${inicio} localizado`);
  return src.slice(a, b);
}
function bloqueHastaSiguienteFuncion(inicio) {
  const a = src.indexOf(inicio);
  assert.ok(a >= 0, `${inicio} localizado`);
  const b = src.indexOf('\nfunction ', a + inicio.length);
  assert.ok(b > a, `siguiente función tras ${inicio} localizada`);
  return src.slice(a, b);
}

// Ejecutamos la función real de saldo, que es la proyección financiera del ledger PM06.
const saldoIni = src.indexOf('function redondearDineroPM06(');
const saldoFin = src.indexOf('function modoSincronizadoPM06(', saldoIni);
assert.ok(saldoIni >= 0 && saldoFin > saldoIni, 'helpers financieros PM06 localizados');
const ctx = { Math, Number };
vm.createContext(ctx);
vm.runInContext(src.slice(saldoIni, saldoFin), ctx);
assert.equal(typeof ctx.calcularSaldoFacturaPM06, 'function');

const base = {
  facturaId: 'alb-p06-1',
  origenFactura: 'albaran',
  empresaId: 'EMP-A',
  localId: 'LOC-A'
};
let pagos = [];

// 1) Estado inicial: obligación 100, sin pagos.
let saldo = ctx.calcularSaldoFacturaPM06(pagos, base.facturaId, base.origenFactura, 100, base.empresaId, base.localId, false);
assert.deepEqual({ pagado: saldo.pagado, pendiente: saldo.pendiente, pagada: saldo.pagada }, { pagado: 0, pendiente: 100, pagada: false });

// 2) Pago parcial real del ledger: 40 -> pendiente 60.
pagos.push({ ...base, id: 'pay-1', operationId: 'pago-1', importe: 40, estado: 'CONFIRMADO' });
saldo = ctx.calcularSaldoFacturaPM06(pagos, base.facturaId, base.origenFactura, 100, base.empresaId, base.localId, false);
assert.equal(saldo.pagado, 40);
assert.equal(saldo.pendiente, 60);
assert.equal(saldo.pagada, false);

// 3) Pago final: +60 -> pagada exacta, nunca depende de un boolean mutable del albarán.
pagos.push({ ...base, id: 'pay-2', operationId: 'pago-2', importe: 60, estado: 'CONFIRMADO' });
saldo = ctx.calcularSaldoFacturaPM06(pagos, base.facturaId, base.origenFactura, 100, base.empresaId, base.localId, false);
assert.equal(saldo.pagado, 100);
assert.equal(saldo.pendiente, 0);
assert.equal(saldo.pagada, true);

// 4) Reverso trazable del último pago: -60 -> vuelve pendiente 60.
pagos.push({ ...base, id: 'rev-2', operationId: 'reverso-2', importe: 60, estado: 'REVERSO', reviertePagoId: 'pay-2' });
saldo = ctx.calcularSaldoFacturaPM06(pagos, base.facturaId, base.origenFactura, 100, base.empresaId, base.localId, false);
assert.equal(saldo.pagado, 40);
assert.equal(saldo.pendiente, 60);
assert.equal(saldo.pagada, false);

// 5) Aislamiento: otro local y otro origen no contaminan la obligación exacta.
const ajenos = [
  { ...base, id: 'otro-local', operationId: 'otro-local-op', localId: 'LOC-B', importe: 999, estado: 'CONFIRMADO' },
  { ...base, id: 'otro-origen', operationId: 'otro-origen-op', origenFactura: 'directa', importe: 999, estado: 'CONFIRMADO' }
];
saldo = ctx.calcularSaldoFacturaPM06([...pagos, ...ajenos], base.facturaId, base.origenFactura, 100, base.empresaId, base.localId, false);
assert.equal(saldo.pagado, 40);
assert.equal(saldo.pendiente, 60);

// 6) Contrato real de registrarPagoPM06: valida identidad, importe, sobrepago y operación pendiente antes de confirmar.
const registrar = bloqueEntre('async function registrarPagoPM06(', 'async function revertirUltimoPagoPM06(');
assert.match(registrar, /!facturaId \|\| !empresaId \|\| !localId/);
assert.match(registrar, /importe2 > saldo\.pendiente \+ 1e-3/);
assert.match(registrar, /El pago supera el saldo pendiente/);
assert.match(registrar, /claveOperacionPM06\("pago", origenFactura, facturaId\)/);
assert.match(registrar, /pagosPM06EnCurso\[clave\]/);
assert.match(registrar, /operationId:/);
assert.match(registrar, /estado: "CONFIRMADO"/);
assert.match(registrar, /some\(\(x3\) => x3\.operationId === pago\.operationId\)/);

// 7) Contrato real de reverso: elige pago confirmado aún no reversado y enlaza reviertePagoId.
const revertir = bloqueHastaSiguienteFuncion('async function revertirUltimoPagoPM06(');
assert.match(revertir, /reviertePagoId/);
assert.match(revertir, /const reversados = new Set/);
assert.match(revertir, /const confirmados = relacionados\.filter/);
assert.match(revertir, /const original = confirmados\[confirmados\.length - 1\]/);
assert.match(revertir, /claveOperacionPM06\("reverso", origenFactura, original\.id\)/);
assert.match(revertir, /estado: "REVERSO"/);
assert.match(revertir, /reviertePagoId: original\.id/);

// 8) P05 sigue cerrando el acceso al ledger desde albarán simple/ambiguo.
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
