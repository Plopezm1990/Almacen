import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM24 P01: confirma que el checkpoint documenta correctamente el alcance
// (enlaces manuales verificados, envío automático inexistente y excluido,
// IA/push probados con redirección controlada a QA, nunca un Deploy Preview
// real), que el resultado registrado no tiene fallos, que las dos
// correcciones reales quedaron aplicadas en fuente.js, y que ni el
// documento ni el arnés publican identificadores internos ni secretos.

const doc = fs.readFileSync('tests/pm24/P01_INTEGRACIONES_CONTROLADAS.md', 'utf8');
const resultado = JSON.parse(fs.readFileSync('tests/pm24/p01-resultado.json', 'utf8'));
const arnes = fs.readFileSync('tests/pm24/p01-integraciones.mjs', 'utf8');
const fuente = fs.readFileSync('fuente.js', 'utf8');

// --- El documento describe el alcance y la metodología correctos ---
assert.match(doc, /E2E\s+local\s+con\s+redirecci\xF3n\s+controlada\s+a\s+QA/);
assert.doesNotMatch(doc, /Netlify Deploy Preview probado/);
assert.match(doc, /env\xEDo autom\xE1tico.*inexistente/i);
assert.match(doc, /se toc\xF3 `main`, producci\xF3n ni TPV/i);
assert.match(doc, /se us\xF3 `service_role`/i);

// --- Las dos correcciones reales quedaron documentadas ---
assert.match(doc, /Enviar por WhatsApp/);
assert.match(doc, /wa\.me\/\?text=/);
assert.match(doc, /registrarErrorSistema/);

// --- Hallazgos documentados sin corregir en este punto (honestidad de alcance) ---
assert.match(doc, /AbortController/);
assert.match(doc, /prefiltros_candidatos/);
assert.match(doc, /empresa_id/);

// --- El resultado real respalda lo que dice el documento ---
assert.equal(resultado.resultados.length, 32, 'se esperaban 32 casos registrados');
const fallos = resultado.resultados.filter((r) => !r.ok);
assert.equal(fallos.length, 0, 'no debe haber fallos en el resultado final: ' + JSON.stringify(fallos));
assert.ok(resultado.bloqueadas.length > 0, 'debe haber al menos una petición de producción bloqueada como prueba');
assert.ok(resultado.bloqueadas.every((b) => b.url.includes('flqercbgpgmmfaakrwkc.supabase.co')), 'las bloqueadas deben ser todas del host de producción');

const casoWhatsapp = resultado.resultados.find((r) => r.caso.startsWith('CORREGIDO: WhatsApp'));
assert.ok(casoWhatsapp && casoWhatsapp.ok, 'debe existir y pasar el caso que confirma la corrección de WhatsApp');
const casosPush = resultado.resultados.filter((r) => r.caso.startsWith('CORREGIDO: push/'));
assert.equal(casosPush.length, 2, 'deben existir los dos casos que confirman la corrección del push (5xx y desconexión)');
assert.ok(casosPush.every((r) => r.ok), 'los casos de corrección del push deben pasar');

// --- Las correcciones están realmente presentes en fuente.js (no solo en el documento) ---
// 1) WhatsApp ya no se genera sin teléfono, en los dos sitios donde se ofrece:
const guardasWhatsapp = fuente.match(/proveedorPorId\([\w.]+\)\?\.telefono && \/\* @__PURE__ \*\/ import_react4\.default\.createElement\(LinkBtn, \{[^}]*href: whatsappHref/g) || [];
assert.equal(guardasWhatsapp.length, 2, 'deben existir exactamente 2 sitios donde "Enviar por WhatsApp" exige teléfono (lista de pedidos y modal de confirmación)');
// 2) El push de caducidad ya no ignora los fallos en silencio:
// (el bundle escapa los acentos como secuencias literales "\xF3" en vez de
// caracteres Unicode reales, así que se evita depender de esa codificación)
assert.match(fuente, /enviar-notificacion respondi.{0,6}\$\{resp2\.status\}/);
assert.match(fuente, /registrarErrorSistema\(err2 && err2\.message, "notificacion-caducidad", err2 && err2\.stack\)/);

// --- Sin secretos ni identificadores internos publicados ---
// Nota: flqercbgpgmmfaakrwkc.supabase.co es el host de PRODUCCIÓN al que
// fuente.js ya llama literalmente en su propio código fuente (visible para
// cualquiera que abra las herramientas de desarrollador) — mencionarlo aquí
// es necesario (es precisamente lo que el arnés bloquea) y no es un secreto
// nuevo. Lo que nunca debe aparecer es el proyecto QA ni ningún otro.
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

console.log('PM24_P01_DOC_VERIFICADO=PASS');
console.log('PM24_P01_RESULTADO_CONSISTENTE=PASS');
console.log('PM24_P01_CORRECCIONES_EN_FUENTE=PASS');
console.log('PM24_P01_SIN_SECRETOS=PASS');
console.log('PM24 P01 — integraciones controladas (correo, WhatsApp, IA, push): contrato OK');
