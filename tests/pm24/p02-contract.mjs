import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM24 P02: confirma que el checkpoint documenta la dimensión "duplicación"
// pedida literalmente por el Plan Maestro para PM-24, que el resultado
// registrado no tiene fallos, que la corrección real (bloqueo síncrono por
// useRef en empezar/enviarRespuesta/finalizarAhora) quedó aplicada en
// fuente.js, y que ni el documento ni el arnés publican identificadores
// internos ni secretos.

const doc = fs.readFileSync('tests/pm24/P02_DUPLICACION.md', 'utf8');
const resultado = JSON.parse(fs.readFileSync('tests/pm24/p02-resultado.json', 'utf8'));
const arnes = fs.readFileSync('tests/pm24/p02-duplicacion.mjs', 'utf8');
const fuente = fs.readFileSync('fuente.js', 'utf8');

// --- El documento describe correctamente el alcance y el defecto ---
assert.match(doc, /acceso, l\xEDmites y duplicaci\xF3n/);
assert.match(doc, /dos\s+entrevistas\s+distintas/);
assert.match(doc, /submitBloqueadoPedidoPM10/);
assert.match(doc, /750ms/);
assert.match(doc, /se us\xF3 `service_role`/i);

// --- El resultado real respalda lo que dice el documento ---
assert.equal(resultado.resultados.length, 9, 'se esperaban 9 casos registrados');
const fallos = resultado.resultados.filter((r) => !r.ok);
assert.equal(fallos.length, 0, 'no debe haber fallos en el resultado final: ' + JSON.stringify(fallos));

const casoEmpezar = resultado.resultados.find((r) => r.caso.includes('doble clic en "Empezar entrevista" no duplica'));
assert.ok(casoEmpezar && casoEmpezar.ok && casoEmpezar.detalle.solicitudesVistas === 1, 'el doble clic en Empezar entrevista debe generar exactamente 1 solicitud');
const casoResponder = resultado.resultados.find((r) => r.caso.includes('doble clic al responder no duplica'));
assert.ok(casoResponder && casoResponder.ok && casoResponder.detalle.solicitudesVistas === 2, 'el doble clic al responder debe dejar el total en exactamente 2 solicitudes');
const casosPush = resultado.resultados.filter((r) => r.caso.startsWith('duplicación/push:'));
assert.equal(casosPush.length, 4, 'deben existir los 4 casos de de-duplicación del push');
assert.ok(casosPush.every((r) => r.ok), 'los casos de de-duplicación del push deben pasar');

// --- La corrección está realmente presente en fuente.js ---
assert.match(fuente, /entrevistaEnvioBloqueadoPM24/);
assert.match(fuente, /function bloqueadoPorEnvioDuplicadoPM24\(\)/);
const usosDelGuard = fuente.match(/if \(bloqueadoPorEnvioDuplicadoPM24\(\)\) return;/g) || [];
assert.equal(usosDelGuard.length, 3, 'el guard debe aplicarse en las 3 funciones que llaman a la IA (empezar, enviarRespuesta, finalizarAhora)');

// --- Sin secretos ni identificadores internos publicados ---
const patronesSecreto = [
  /(?!flqercbgpgmmfaakrwkc\.supabase\.co)[a-z]{20}\.supabase\.co/i,
  /service_role_key/i,
  /SUPABASE_SERVICE_ROLE_KEY/,
  /sb_secret_/i,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /qjqorixtkilwsndqayyx/,
  /cqtghwiuxrqrxupyonqf/
];
for (const patron of patronesSecreto) {
  assert.doesNotMatch(doc, patron, 'no debe publicarse un identificador interno o secreto en el documento: ' + patron);
  assert.doesNotMatch(arnes, patron, 'no debe publicarse un identificador interno o secreto en el arnés: ' + patron);
  assert.doesNotMatch(JSON.stringify(resultado), patron, 'no debe publicarse un identificador interno o secreto en el resultado: ' + patron);
}

console.log('PM24_P02_DOC_VERIFICADO=PASS');
console.log('PM24_P02_RESULTADO_CONSISTENTE=PASS');
console.log('PM24_P02_CORRECCION_EN_FUENTE=PASS');
console.log('PM24_P02_SIN_SECRETOS=PASS');
console.log('PM24 P02 — duplicación (IA y push): contrato OK');
