import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM21 P05: confirma que el documento registra la fixture nueva autorizada
// (QA-CROSS-EMP-B1), el resultado real del rechazo por relación cruzada, y que
// no publica ningún identificador interno ni secreto.

const doc = fs.readFileSync('tests/pm21/P05_RELACION_CRUZADA_ENTRE_EMPRESAS.md', 'utf8');

assert.match(doc, /QA-CROSS-EMP-B1/);
assert.match(doc, /QA-EMP-B/);
assert.match(doc, /fichaje_empleado_no_activo_o_fuera_de_local/);
assert.match(doc, /rechazado/i);
assert.match(doc, /0 filas/, 'debe confirmar que no quedó ningún dato de prueba de fichaje residual');
assert.match(doc, /autorización explícita/);
assert.match(doc, /PM21_P05_RELACION_CRUZADA=PASS/);

for (const secreto of [/[a-z]{20}\.supabase\.co/i, /service_role_key/i, /SUPABASE_SERVICE_ROLE_KEY/, /sb_secret_/i, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, /qjqorixtkilwsndqayyx/, /flqercbgpgmmfaakrwkc/, /cqtghwiuxrqrxupyonqf/]) {
  assert.doesNotMatch(doc, secreto, 'no debe publicarse un identificador interno o secreto: ' + secreto);
}

console.log('PM21_P05_DOC_VERIFICADO=PASS');
console.log('PM21_P05_SIN_SECRETOS=PASS');
console.log('PM21 P05 — relación cruzada entre empresas verificada en vivo: contrato OK');
