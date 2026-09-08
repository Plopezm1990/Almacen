import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM19 P01: "controles conservan responsable/fecha" y "históricos completos" (texto
// literal de PM19, matriz de cierre "APPCC y aceite de freidoras").
//
// Bug real encontrado por inspección de código: crearLogicaAppcc no exigía responsable
// en registrarAppcc (se podía guardar vacío), eliminarRegistroAppcc borraba el registro
// físicamente del array (sin cancelación trazable, violando la regla de nunca-borrado-
// silencioso ya aplicada en el resto del proyecto) y el módulo entero no llamaba a
// registrarAuditoria ni una sola vez. Este contrato prueba, de forma aislada, las dos
// funciones puras nuevas que corrigen esto.

const src = fs.readFileSync('fuente.js', 'utf8');

function extraerFuncion(nombre, hastaMarcador) {
  const ini = src.indexOf(`function ${nombre}(`);
  assert.ok(ini >= 0, `${nombre} no encontrada`);
  const fin = src.indexOf(hastaMarcador, ini);
  assert.ok(fin > ini, `no se pudo acotar ${nombre}`);
  return src.slice(ini, fin);
}

function nuevoContexto(codigo) {
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(codigo, ctx);
  return ctx;
}

// ---- validarRegistroAppccPM19: responsable obligatorio, sin excepciones. ----
{
  const ctx = nuevoContexto(extraerFuncion('validarRegistroAppccPM19', 'function prepararCancelacionAppccPM19('));

  assert.equal(ctx.validarRegistroAppccPM19({ responsable: 'Ana' }).ok, true);
  assert.equal(ctx.validarRegistroAppccPM19({ responsable: 'Ana' }).responsable, 'Ana');
  assert.equal(ctx.validarRegistroAppccPM19({ responsable: '  Ana  ' }).responsable, 'Ana', 'debe recortar espacios');

  assert.equal(ctx.validarRegistroAppccPM19({}).ok, false);
  assert.equal(ctx.validarRegistroAppccPM19({ responsable: '' }).ok, false);
  assert.equal(ctx.validarRegistroAppccPM19({ responsable: '   ' }).ok, false, 'solo espacios no cuenta como responsable real');
  assert.equal(ctx.validarRegistroAppccPM19(null).ok, false);
  console.log('P01_PM19_RESPONSABLE_APPCC_OBLIGATORIO=PASS');
}

// ---- prepararCancelacionAppccPM19: cancelación trazable, nunca borrado. ----
{
  const ctx = nuevoContexto(extraerFuncion('prepararCancelacionAppccPM19', 'function crearLogicaAppcc('));

  // Negativo: registro inexistente.
  assert.equal(ctx.prepararCancelacionAppccPM19(null).ok, false);

  // Negativo: motivo y actor obligatorios -- una cancelación sin motivo no es trazable.
  const registro = { id: 'r1', cancelado: false };
  assert.equal(ctx.prepararCancelacionAppccPM19(registro, { actorNombre: 'Ana' }).ok, false, 'sin motivo debe rechazarse');
  assert.equal(ctx.prepararCancelacionAppccPM19(registro, { motivo: 'Error de captura' }).ok, false, 'sin actor debe rechazarse');

  // Positivo: con motivo y actor, se prepara la cancelación (nunca borra nada aquí --
  // esta función es pura, solo decide si procede).
  const ok = ctx.prepararCancelacionAppccPM19(registro, { motivo: 'Error de captura', actorNombre: 'Ana' });
  assert.equal(ok.ok, true);
  assert.equal(ok.motivo, 'Error de captura');
  assert.equal(ok.actorNombre, 'Ana');
  assert.equal(ok.replayed, false);

  // Replay: un registro ya cancelado se trata como replay (no como error, no como
  // segunda cancelación) -- idempotente ante un reintento.
  const yaCancelado = { id: 'r1', cancelado: true, motivoCancelacion: 'Error de captura', canceladoPor: 'Ana' };
  const replay = ctx.prepararCancelacionAppccPM19(yaCancelado, { motivo: 'Otro motivo', actorNombre: 'Otra persona' });
  assert.equal(replay.ok, true);
  assert.equal(replay.replayed, true);
  console.log('P01_PM19_CANCELACION_APPCC_TRAZABLE_Y_REPLAY=PASS');
}

console.log('PM19 P01 (APPCC histórico trazable) — funciones puras: contrato OK');
