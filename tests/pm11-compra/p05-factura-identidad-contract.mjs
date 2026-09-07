import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');
const helperIni = src.indexOf('const confirmacionesAlbaranPM11Memoria');
const albIni = src.indexOf('function crearLogicaAlbaranes({', helperIni);
assert.ok(helperIni >= 0 && albIni > helperIni, 'bloque de helpers PM11 localizado');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(src.slice(helperIni, albIni), ctx);
for (const fn of [
  'firmaConfirmacionAlbaranPM11',
  'normalizarNumeroFacturaPM11',
  'fechaFacturaValidaPM11',
  'albaranEsFacturaOperativaPM11',
  'claveObligacionFacturaAlbaranPM11',
  'validarIdentidadFacturaAlbaranPM11'
]) assert.equal(typeof ctx[fn], 'function', `${fn} disponible`);

const base = {
  id: 'alb-f1',
  pedidoId: 'ped-1',
  empresaId: 'E1',
  localId: 'L1',
  proveedorId: 'prov-1',
  fecha: '2026-09-07',
  numero: 'A-001',
  lineas: [{ productoId: 'p1', cantidad: 2, udsPorCaja: 1, precioBruto: 3, ivaPct: 10 }]
};

// Un albarán simple explícito no es obligación financiera.
let r = ctx.validarIdentidadFacturaAlbaranPM11({ alb: { ...base, esFactura: false }, empresaId: 'E1', localActivoId: 'L1' });
assert.equal(r.ok, true);
assert.equal(r.esFactura, false);
assert.equal(r.clave, null);

// Legacy undefined/null tampoco puede convertirse silenciosamente en deuda.
r = ctx.validarIdentidadFacturaAlbaranPM11({ alb: { ...base }, empresaId: 'E1', localActivoId: 'L1' });
assert.equal(r.ok, true);
assert.equal(r.esFactura, false);
r = ctx.validarIdentidadFacturaAlbaranPM11({ alb: { ...base }, empresaId: 'E1', localActivoId: 'L1', exigirFactura: true });
assert.equal(r.ok, false);
assert.equal(r.codigo, 'no_es_factura');

// Una factura explícita exige nº, fecha válida y contexto.
r = ctx.validarIdentidadFacturaAlbaranPM11({ alb: { ...base, esFactura: true, numeroFactura: '', fechaFactura: '2026-09-07' }, empresaId: 'E1', localActivoId: 'L1' });
assert.equal(r.ok, false);
assert.equal(r.campo, 'numeroFactura');
r = ctx.validarIdentidadFacturaAlbaranPM11({ alb: { ...base, esFactura: true, numeroFactura: 'F-001', fechaFactura: '2026-02-31' }, empresaId: 'E1', localActivoId: 'L1' });
assert.equal(r.ok, false);
assert.equal(r.codigo, 'fecha_invalida');

const factura = { ...base, esFactura: true, numeroFactura: ' F-001 ', fechaFactura: '2026-09-07' };
r = ctx.validarIdentidadFacturaAlbaranPM11({ alb: factura, empresaId: 'E1', localActivoId: 'L1' });
assert.equal(r.ok, true);
assert.equal(r.esFactura, true);
assert.equal(r.numeroFactura, 'F-001');
assert.equal(r.fechaFactura, '2026-09-07');
assert.equal(r.clave, 'E1:prov-1:f-001');
assert.equal(ctx.albaranEsFacturaOperativaPM11({ ...factura, estado: 'confirmado' }), true);
assert.equal(ctx.albaranEsFacturaOperativaPM11({ ...factura, estado: 'borrador' }), false);

// Otra obligación confirmada con la misma identidad empresa/proveedor/nº se rechaza.
const yaConfirmada = { ...factura, id: 'alb-previa', estado: 'confirmado', numeroFactura: 'f-001' };
r = ctx.validarIdentidadFacturaAlbaranPM11({ alb: factura, albaranes: [yaConfirmada], empresaId: 'E1', localActivoId: 'L1' });
assert.equal(r.ok, false);
assert.equal(r.codigo, 'factura_duplicada');
assert.equal(r.duplicadaId, 'alb-previa');

// El mismo nº de otro proveedor o empresa no colisiona con esta obligación.
r = ctx.validarIdentidadFacturaAlbaranPM11({
  alb: factura,
  albaranes: [{ ...yaConfirmada, proveedorId: 'prov-2' }],
  empresaId: 'E1', localActivoId: 'L1'
});
assert.equal(r.ok, true);
r = ctx.validarIdentidadFacturaAlbaranPM11({
  alb: factura,
  albaranes: [{ ...yaConfirmada, empresaId: 'E2' }],
  empresaId: 'E1', localActivoId: 'L1'
});
assert.equal(r.ok, true);

// P04 ahora congela también la decisión financiera: cambiar false->true cambia firma documental.
const firmaSimple = ctx.firmaConfirmacionAlbaranPM11({ ...base, esFactura: false }, 'E1', 'L1');
const firmaFactura = ctx.firmaConfirmacionAlbaranPM11(factura, 'E1', 'L1');
assert.notEqual(firmaSimple, firmaFactura);
assert.ok(firmaFactura.includes('F-001'));
assert.ok(firmaFactura.includes('2026-09-07'));

// Nuevas altas PM11 deben nacer como albarán simple explícito; el literal true puede existir
// legítimamente en helpers/validaciones, por eso se comprueban los defaults false, no una ausencia global.
assert.ok((src.match(/esFactura: false,/g) || []).length >= 4, 'flujos de alta nacen como albarán simple explícito');
assert.doesNotMatch(src, /esFactura !== false/);

const confirmarIni = src.indexOf('  function confirmarAlbaran(alb) {', albIni);
const confirmarFin = src.indexOf('  function anularAlbaran(alb) {', confirmarIni);
assert.ok(confirmarIni >= 0 && confirmarFin > confirmarIni);
const confirmar = src.slice(confirmarIni, confirmarFin);
for (const patron of [
  /validarIdentidadFacturaAlbaranPM11\(\{ alb, albaranes, empresaId, localActivoId \}\)/,
  /obligacionFacturaPM11/,
  /facturaId: albaranId/,
  /origenFactura: "albaran"/,
  /clave: facturaPM11\.clave/,
  /esFactura: facturaPM11\.esFactura === true/,
  /numeroFactura: facturaPM11\.esFactura \? facturaPM11\.numeroFactura/,
  /fechaFactura: facturaPM11\.esFactura \? facturaPM11\.fechaFactura/
]) assert.match(confirmar, patron);
const fronteraPos = confirmar.indexOf('validarIdentidadFacturaAlbaranPM11');
const replayPos = confirmar.indexOf('resolverConfirmacionAlbaranPM11');
const fisicoPos = confirmar.indexOf('procesarRecepcion({');
assert.ok(fronteraPos >= 0 && fronteraPos < replayPos && replayPos < fisicoPos, 'factura se valida antes del replay/efecto logístico');

const pagarIni = src.indexOf('  async function marcarPagada(id, pagada, importe)', albIni);
const pagarFin = src.indexOf('  function procesarRecepcion({', pagarIni);
assert.ok(pagarIni >= 0 && pagarFin > pagarIni);
const pagar = src.slice(pagarIni, pagarFin);
for (const patron of [
  /a22\.estado !== "confirmado"/,
  /exigirFactura: true/,
  /numero: facturaPM11\.numeroFactura/,
  /fecha: facturaPM11\.fechaFactura/,
  /origenFactura: "albaran"/,
  /registrarPagoPM06/,
  /revertirUltimoPagoPM06/
]) assert.match(pagar, patron);

// Cuentas por pagar / Facturas deben usar únicamente factura operativa explícita.
assert.ok((src.match(/albaranEsFacturaOperativaPM11\(a22\)/g) || []).length >= 2);

// Regresiones estructurales de los puntos ya cerrados.
assert.match(src, /function firmaSolicitudRecepcionPM11/);
assert.match(src, /function resolverConfirmacionAlbaranPM11/);
assert.match(src, /operationId: `pm10-recepcion-albaran:\$\{alb\.id\}`/);

console.log('PM11_COMPRA_P05_FACTURA_IDENTIDAD=PASS');
