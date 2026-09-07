import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync('fuente.js', 'utf8');
const helperIni = src.indexOf('const confirmacionesAlbaranPM11Memoria');
const albIni = src.indexOf('function crearLogicaAlbaranes({', helperIni);
assert.ok(helperIni >= 0 && albIni > helperIni, 'helpers P04 presentes antes de Albaranes');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(src.slice(helperIni, albIni), ctx);
assert.equal(typeof ctx.firmaConfirmacionAlbaranPM11, 'function');
assert.equal(typeof ctx.claveConfirmacionAlbaranPM11, 'function');
assert.equal(typeof ctx.resolverConfirmacionAlbaranPM11, 'function');
assert.equal(typeof ctx.resultadoReplayAlbaranPM11, 'function');

const alb = {
  id: 'alb-1',
  pedidoId: 'ped-1',
  empresaId: 'E1',
  localId: 'L1',
  proveedorId: 'prov-1',
  fecha: '2026-09-07',
  numero: 'A-001',
  lineas: [
    { productoId: 'p1', descripcion: 'Harina', cantidad: 2, udsPorCaja: 1, tipoUnidad: 'unidad', precioBruto: 3, ivaPct: 10 }
  ]
};
const firma = ctx.firmaConfirmacionAlbaranPM11(alb, 'E1', 'L1');
assert.equal(typeof firma, 'string');
assert.ok(firma.includes('alb-1'));
assert.ok(firma.includes('ped-1'));
assert.ok(firma.includes('prov-1'));

let r = ctx.resolverConfirmacionAlbaranPM11({ alb, empresaId: 'E1', localActivoId: 'L1' });
assert.equal(r.ok, true);
assert.equal(r.replayed, false);
assert.equal(r.firma, firma);

const confirmado = {
  ...alb,
  estado: 'confirmado',
  avisosPrecio: [{ nombre: 'Harina', variacion: 2 }],
  confirmacionPM11: { firma }
};
r = ctx.resolverConfirmacionAlbaranPM11({ alb, existente: confirmado, empresaId: 'E1', localActivoId: 'L1' });
assert.equal(r.ok, true);
assert.equal(r.replayed, true, 'reconfirmación persistida exacta debe ser replay');
assert.equal(r.avisos.length, 1);

const cambiado = { ...alb, lineas: [{ ...alb.lineas[0], cantidad: 3 }] };
r = ctx.resolverConfirmacionAlbaranPM11({ alb: cambiado, existente: confirmado, empresaId: 'E1', localActivoId: 'L1' });
assert.equal(r.ok, false);
assert.equal(r.codigo, 'operation_id_conflict', 'mismo id con contenido distinto debe bloquearse');

r = ctx.resolverConfirmacionAlbaranPM11({
  alb,
  existente: { ...alb, estado: 'confirmado', confirmacionPM11: null },
  empresaId: 'E1', localActivoId: 'L1'
});
assert.equal(r.ok, false);
assert.equal(r.codigo, 'documento_ya_confirmado', 'albarán legado confirmado debe fallar cerrado, nunca reentrar stock');

r = ctx.resolverConfirmacionAlbaranPM11({
  alb,
  memoria: { firma, avisos: [] },
  empresaId: 'E1', localActivoId: 'L1'
});
assert.equal(r.ok, true);
assert.equal(r.replayed, true, 'doble intento en memoria no produce segundo efecto');

r = ctx.resolverConfirmacionAlbaranPM11({
  alb: cambiado,
  memoria: { firma, avisos: [] },
  empresaId: 'E1', localActivoId: 'L1'
});
assert.equal(r.ok, false);
assert.equal(r.codigo, 'operation_id_conflict');

r = ctx.resolverConfirmacionAlbaranPM11({ alb: { ...alb, id: '' }, empresaId: 'E1', localActivoId: 'L1' });
assert.equal(r.ok, false);
assert.equal(r.codigo, 'campo_obligatorio');

const replay = ctx.resultadoReplayAlbaranPM11([{ x: 1 }], 'alb-1');
assert.equal(Array.isArray(replay), true, 'se conserva compatibilidad de retorno como array de avisos');
assert.equal(replay.length, 1);
assert.equal(replay.replayed, true);
assert.equal(replay.operationId, 'pm11-albaran:alb-1');

const confirmarIni = src.indexOf('  function confirmarAlbaran(alb) {', albIni);
const confirmarFin = src.indexOf('  function anularAlbaran(alb) {', confirmarIni);
assert.ok(confirmarIni >= 0 && confirmarFin > confirmarIni, 'confirmarAlbaran localizado');
const confirmar = src.slice(confirmarIni, confirmarFin);

for (const patron of [
  /resolverConfirmacionAlbaranPM11/,
  /confirmacionesAlbaranPM11Memoria/,
  /\(albaranes \|\| \[\]\)\.find/,
  /pedidoLigado\.proveedorId/,
  /proveedor del albarán no coincide con el proveedor del pedido enlazado/,
  /pedidoLigado\.localId/,
  /validarRecepcionPedidoPM10/,
  /operationId: `pm10-recepcion-albaran:\$\{alb\.id\}`/,
  /replayedRecepcionPM10/,
  /confirmacionPM11/,
  /firma: guardiaPM11\.firma/,
  /guardarAlbaran\(\{\s*\.\.\.alb,\s*lineas:\s*lineasResueltas,\s*estado:\s*"confirmado"/,
  /resultadoReplayAlbaranPM11/
]) assert.match(confirmar, patron);

assert.match(src.slice(helperIni, albIni), /existente && existente\.estado === "confirmado"/);
assert.match(src.slice(helperIni, albIni), /operation_id_conflict/);
assert.match(src.slice(helperIni, albIni), /documento_ya_confirmado/);

const guardiaPos = confirmar.indexOf('resolverConfirmacionAlbaranPM11');
const pedidoPos = confirmar.indexOf('let pedidoLigado');
const validarPos = confirmar.indexOf('validarRecepcionPedidoPM10');
const procesarPos = confirmar.indexOf('procesarRecepcion({');
const proveedorPos = confirmar.indexOf('pedidoLigado.proveedorId');
const guardarPos = confirmar.indexOf('guardarAlbaran({');
assert.ok(guardiaPos >= 0 && guardiaPos < pedidoPos, 'replay documental se resuelve antes de volver a validar saldo del pedido');
assert.ok(proveedorPos >= 0 && proveedorPos < validarPos, 'proveedor se reconcilia con pedido antes de recepción');
assert.ok(validarPos >= 0 && validarPos < procesarPos, 'validación logística precede cualquier efecto físico');
assert.ok(procesarPos >= 0 && procesarPos < guardarPos, 'se guarda confirmado solo tras resolver la recepción');

// El replay de procesarRecepcion no puede volver a incrementar cantidadRecibida.
assert.match(confirmar, /if \(pedidoLigado && !replayedRecepcionPM10\)/);

// La base P03 debe seguir presente: recepción directa también conserva su operación idempotente.
assert.match(src, /function firmaSolicitudRecepcionPM11/);
assert.match(src, /recepcionesPM11/);

console.log('PM11_COMPRA_P04_ALBARAN_TRAZABILIDAD=PASS');
