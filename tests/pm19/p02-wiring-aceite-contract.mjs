import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM19 P02: confirma, por inspección estática, que registrarCambio y registrarRelleno
// validan de verdad el responsable antes de descontar aceite (no basta con que exista la
// función si no se usa antes del efecto de stock).

const src = fs.readFileSync('fuente.js', 'utf8');
const ini = src.indexOf('function crearLogicaAceite(');
assert.ok(ini >= 0, 'crearLogicaAceite no encontrada');
const fin = src.indexOf('function crearLogicaFacturasDirectas(', ini);
const cuerpo = src.slice(ini, fin);

// ---- registrarCambio: valida antes de crear el registro; guarda el valor recortado. ----
{
  const iniFn = cuerpo.indexOf('function registrarCambio(');
  const finFn = cuerpo.indexOf('function registrarRelleno(', iniFn);
  const fnCambio = cuerpo.slice(iniFn, finFn);
  assert.match(fnCambio, /const validacionResponsable = validarResponsableRegistroAceitePM19\(responsable\);/, 'debe validar el responsable');
  assert.match(fnCambio, /if \(!validacionResponsable\.ok\) return validacionResponsable;/, 'un responsable inválido debe rechazar antes de tocar stock');
  assert.match(fnCambio, /responsable: validacionResponsable\.responsable,/, 'debe guardar el responsable ya validado/recortado, no el crudo');
  console.log('P02_PM19_REGISTRAR_CAMBIO_VALIDA_RESPONSABLE=PASS');
}

// ---- registrarRelleno: misma validación, y ahora también deja auditoría (antes no
// llamaba a registrarAuditoria en absoluto). ----
{
  const iniFn = cuerpo.indexOf('function registrarRelleno(');
  const finFn = cuerpo.indexOf('function eliminarRegistroAceite(', iniFn);
  const fnRelleno = cuerpo.slice(iniFn, finFn);
  assert.match(fnRelleno, /const validacionResponsable = validarResponsableRegistroAceitePM19\(responsable\);/, 'debe validar el responsable');
  assert.match(fnRelleno, /if \(!validacionResponsable\.ok\) return validacionResponsable;/, 'un responsable inválido debe rechazar antes de tocar stock');
  assert.match(fnRelleno, /responsable: validacionResponsable\.responsable,/, 'debe guardar el responsable ya validado/recortado, no el crudo');
  assert.match(fnRelleno, /registrarAuditoria\("Relleno de aceite"/, 'el relleno debe dejar rastro de auditoría, igual que el cambio');
  console.log('P02_PM19_REGISTRAR_RELLENO_VALIDA_RESPONSABLE_Y_AUDITA=PASS');
}

console.log('PM19 P02 (wiring aceite) — responsable obligatorio conectado: contrato OK');
