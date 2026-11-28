// Contrato de H-31 (auditoría del TPV, 26/11/2026): un pendiente de cobro local se retira cuando el
// servidor ya resolvió ese pago.
//
// Defecto: `leerEstadoCobroF4` comprobaba el pendiente contra la lectura directa de la tabla `pagos`
// (solo los 10 últimos checkouts de la cuenta y sujeta a permisos) ANTES de sustituirla por la lista
// completa que devuelve `abc_estado_pago_mixto_cuenta`. Un pendiente cuyo pago estaba CANCELADO o
// CONFIRMADO en el servidor, pero fuera de esa lectura, se quedaba en el navegador indefinidamente
// (el de 13/11 de la auditoría) y bloqueaba iniciar un cobro con otro medio de pago.
//
//   node tests/rediseno/h31-pendiente-cobro-contra-servidor-contract.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../../', import.meta.url);
const leer = (f) => fs.readFileSync(new URL(f, root), 'utf8').replace(/\r\n/g, '\n');
const fuentes = [['fuente.js', leer('fuente.js')], ['fuente-recuperado.js', leer('source-recovery/fuente-recuperado.js')]];

const cuerpos = [];
for (const [nombre, codigo] of fuentes) {
  const ini = codigo.indexOf('async function leerEstadoCobroF4()');
  assert.ok(ini > 0, `${nombre}: existe leerEstadoCobroF4`);
  const fin = codigo.indexOf('\n  }\n', ini);
  const cuerpo = codigo.slice(ini, fin);
  cuerpos.push(cuerpo);

  const iPagosServidor = cuerpo.indexOf('pagos = detalleB05.pagos');
  const iIntentosServidor = cuerpo.indexOf('intentos = detalleB05.intentos');
  const iLeePendiente = cuerpo.indexOf('leerPendienteCobroF4(');
  const iBuscaPago = cuerpo.indexOf('pagos.find((x3) => String(x3.id) === String(pendienteLocal.pagoId))');
  const iLimpia = cuerpo.indexOf('limpiarPendienteCobroF4(');

  assert.ok(iPagosServidor > 0 && iIntentosServidor > 0, `${nombre}: la lista de pagos del servidor sustituye a la lectura directa`);
  assert.ok(iLeePendiente > iPagosServidor && iLeePendiente > iIntentosServidor,
    `${nombre}: el pendiente se lee DESPUÉS de tener la lista completa de pagos del servidor`);
  assert.ok(iBuscaPago > iLeePendiente && iLimpia > iBuscaPago,
    `${nombre}: se busca el pago del pendiente en esa lista y solo entonces se limpia`);
  assert.match(cuerpo, /\["CONFIRMADO", "RECHAZADO", "CANCELADO", "REEMBOLSADO"\]\.includes\(String\(pago\.estado \|\| ""\)\)/,
    `${nombre}: solo se retira si el servidor lo dio por resuelto (un pago pendiente o incierto se conserva)`);
  assert.equal((cuerpo.match(/leerPendienteCobroF4\(/g) || []).length, 1, `${nombre}: una única lectura del pendiente en el estado de cobro`);
}
assert.equal(cuerpos[0], cuerpos[1], 'el estado de cobro mantiene paridad con la recuperación');

console.log('H-31 contrato del pendiente de cobro contra el servidor OK');
