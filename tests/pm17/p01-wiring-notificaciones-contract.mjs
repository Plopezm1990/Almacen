import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM17 P01: activarSuscripcionPushPM17 no sirve de nada si Notificaciones.activar() no la
// usa de verdad -- este contrato comprueba, por inspección estática, que el componente
// real está conectado al helper con rollback (no quedó la vieja llamada directa a
// pushManager.subscribe + upsert sin protección).

const src = fs.readFileSync('fuente.js', 'utf8');

const iniComponente = src.indexOf('function Notificaciones({ localActivoId = null }) {');
assert.ok(iniComponente >= 0, 'componente Notificaciones no encontrado');
const iniActivar = src.indexOf('async function activar() {', iniComponente);
assert.ok(iniActivar >= 0, 'activar() no encontrada dentro de Notificaciones');
const finActivar = src.indexOf('async function desactivar() {', iniActivar);
assert.ok(finActivar > iniActivar, 'no se pudo acotar el cuerpo de activar()');
const cuerpoActivar = src.slice(iniActivar, finActivar);

assert.match(cuerpoActivar, /await activarSuscripcionPushPM17\(\{/, 'activar() debe delegar en el helper con rollback');
assert.match(cuerpoActivar, /suscribir: \(\) => registro\.pushManager\.subscribe\(/, 'debe seguir suscribiendo con el registro real del service worker');
assert.match(cuerpoActivar, /deshacerSuscripcion: \(suscripcion\) => suscripcion\.unsubscribe\(\)/, 'debe deshacer con el unsubscribe real de la suscripción creada');
assert.doesNotMatch(cuerpoActivar, /if \(errInsert\) throw errInsert;\s*\n\s*setSuscrito\(true\);/, 'no debe quedar el throw directo de antes, sin paso por el helper');

console.log('P01_PM17_ACTIVAR_USA_HELPER_CON_ROLLBACK=PASS');
console.log('PM17 P01 (wiring nativo) — Notificaciones.activar() conectado al rollback: contrato OK');
