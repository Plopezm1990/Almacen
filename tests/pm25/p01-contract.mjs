import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM25 P01: confirma que el checkpoint documenta el hallazgo real (borrado
// físico silencioso en el servidor al restaurar un backup antiguo con nube
// activa) y la corrección aplicada, que el resultado registrado (verificado
// en vivo contra QA real) no tiene fallos, que la corrección está realmente
// presente en fuente.js, y que ni el documento ni el arnés publican
// identificadores internos ni secretos.

const doc = fs.readFileSync('tests/pm25/P01_RESPALDO_NUBE_ACTIVA.md', 'utf8');
const resultado = JSON.parse(fs.readFileSync('tests/pm25/p01-resultado.json', 'utf8'));
const arnes = fs.readFileSync('tests/pm25/p01-respaldo-nube-activa.mjs', 'utf8');
const fuente = fs.readFileSync('fuente.js', 'utf8');

// --- El documento describe el hallazgo y la corrección ---
assert.match(doc, /borra f\xEDsicamente en el servidor/);
assert.match(doc, /sincronizarColeccionEmpresa/);
assert.match(doc, /Restaurar respaldo\s+—\s+bloqueado/);
assert.match(doc, /se us\xF3 `service_role`/i);
assert.match(doc, /proxy\s+"tonto"/);

// --- El resultado real (verificado en vivo contra QA) respalda el documento ---
assert.equal(resultado.resultados.length, 9, 'se esperaban 9 casos registrados');
const fallos = resultado.resultados.filter((r) => !r.ok);
assert.equal(fallos.length, 0, 'no debe haber fallos en el resultado final: ' + JSON.stringify(fallos));

const casoBloqueo = resultado.resultados.find((r) => r.caso.includes('el modal de restauración se bloquea con diagnóstico'));
assert.ok(casoBloqueo && casoBloqueo.ok, 'debe existir y pasar el caso que confirma el bloqueo del modal');
const casoNoBorrado = resultado.resultados.find((r) => r.caso.includes('QA-PROV-A'));
assert.ok(casoNoBorrado && casoNoBorrado.ok, 'debe existir y pasar el caso que confirma que el fixture preexistente no se borró');
const casoLimpieza = resultado.resultados.find((r) => r.caso.startsWith('limpieza:'));
assert.ok(casoLimpieza && casoLimpieza.ok, 'la limpieza de los fixtures sintéticos debe haberse completado');

// --- La corrección está realmente presente en fuente.js ---
assert.match(fuente, /bloqueadoPorNubeActivaPM25/);
// (el bundle escapa el guion largo como secuencia literal "—" en vez de
// un carácter Unicode real, así que se evita depender de esa codificación)
assert.match(fuente, /Restaurar respaldo.{1,10}bloqueado/);
assert.match(fuente, /window\.__nubeActiva === true\) return;/);

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

console.log('PM25_P01_DOC_VERIFICADO=PASS');
console.log('PM25_P01_RESULTADO_CONSISTENTE=PASS');
console.log('PM25_P01_CORRECCION_EN_FUENTE=PASS');
console.log('PM25_P01_SIN_SECRETOS=PASS');
console.log('PM25 P01 — respaldo local con nube activa: contrato OK');
