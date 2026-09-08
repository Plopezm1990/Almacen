import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM19 P01: confirma, por inspección estática, que la validación de responsable y la
// cancelación trazable están realmente conectadas -- crearLogicaAppcc, la composición y
// el componente Appcc.

const src = fs.readFileSync('fuente.js', 'utf8');

// ---- crearLogicaAppcc: recibe registrarAuditoria, usa las funciones puras, expone
// cancelarRegistroAppcc en vez de un borrado físico. ----
{
  const ini = src.indexOf('function crearLogicaAppcc(');
  assert.ok(ini >= 0, 'crearLogicaAppcc no encontrada');
  const fin = src.indexOf('function crearLogicaFichaje(', ini);
  const cuerpo = src.slice(ini, fin);

  assert.match(cuerpo, /function crearLogicaAppcc\(\{ puntosControl, registrosAppcc, setPuntosControl, setRegistrosAppcc, localActivoId, registrarAuditoria \}\)/, 'debe recibir registrarAuditoria');
  assert.match(cuerpo, /const validacion = validarRegistroAppccPM19\(data\);/, 'registrarAppcc debe validar con la función pura');
  assert.match(cuerpo, /if \(registrarAuditoria\) registrarAuditoria\("Registrar control APPCC"/, 'debe dejar rastro de auditoría al registrar');
  assert.match(cuerpo, /function cancelarRegistroAppcc\(id, opciones = \{\}\)/, 'debe exponer cancelación trazable');
  assert.doesNotMatch(cuerpo, /function eliminarRegistroAppcc/, 'no debe quedar la función de borrado físico');
  assert.doesNotMatch(cuerpo, /setRegistrosAppcc\(\(s22\) => s22\.filter\(\(r2\) => r2\.id !== id\)\)/, 'no debe quedar ningún borrado físico de registros');
  assert.match(cuerpo, /cancelado: true, motivoCancelacion: preparada\.motivo, canceladoPor: preparada\.actorNombre, canceladoEn/, 'cancelar debe marcar el registro, no eliminarlo');
  console.log('P01_PM19_LOGICA_APPCC_CONECTADA=PASS');
}

// ---- Composición: pasa registrarAuditoria y cancelarRegistroAppcc (no la función vieja). ----
{
  assert.match(src, /crearLogicaAppcc\(\{ puntosControl, registrosAppcc, setPuntosControl, setRegistrosAppcc, localActivoId, registrarAuditoria \}\)/, 'la composición debe pasar registrarAuditoria a crearLogicaAppcc');
  assert.doesNotMatch(src, /eliminarRegistroAppcc/, 'no debe quedar ninguna referencia a la función de borrado físico en todo el bundle');
  console.log('P01_PM19_COMPOSICION_APPCC_ACTUALIZADA=PASS');
}

// ---- Componente Appcc: valida antes de guardar, muestra error, ofrece cancelar con
// motivo/actor y sigue mostrando los registros cancelados en el histórico impreso. ----
{
  const ini = src.indexOf('function Appcc({');
  assert.ok(ini >= 0, 'componente Appcc no encontrado');
  const fin = src.indexOf('function lineaEncargo(', ini);
  const cuerpo = src.slice(ini, fin);

  assert.match(cuerpo, /cancelarRegistroAppcc,/, 'el componente debe recibir cancelarRegistroAppcc como prop');
  assert.match(cuerpo, /const res = registrarAppcc\(\{/, 'submitRegistro debe leer el resultado {ok,error} real');
  assert.match(cuerpo, /if \(!res\.ok\) \{\s*setErrorRegistro\(res\.error\);/, 'un registro rechazado debe mostrar el error, no fallar en silencio');
  assert.match(cuerpo, /function confirmarCancelarRegistro\(\)/, 'debe existir el flujo de confirmación de cancelación');
  assert.match(cuerpo, /cancelarRegistroAppcc\(cancelarRegistro\.id, \{/, 'la cancelación real debe llamar a cancelarRegistroAppcc');
  assert.match(cuerpo, /r2\.cancelado === true \? `CANCELADO/, 'el histórico impreso debe seguir mostrando los registros cancelados, marcados como tales');
  assert.match(cuerpo, /noConformes = registrosPeriodo\.filter\(\(r2\) => r2\.conforme === false && r2\.cancelado !== true\)/, 'un registro cancelado no debe seguir contando como desviación activa');
  console.log('P01_PM19_COMPONENTE_APPCC_CONECTADO=PASS');
}

console.log('PM19 P01 (wiring APPCC) — histórico trazable de punta a punta: contrato OK');
