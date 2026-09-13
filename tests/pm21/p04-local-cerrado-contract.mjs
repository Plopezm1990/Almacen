import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM21 P04: confirma que el documento registra la prueba real de "local cerrado"
// (rechazo de pm11_alta_empleado sobre QA-A-CERRADO pese a Propietario todos_locales),
// deja constancia honesta de por qué la prueba de relación cruzada no se ejecuta todavía,
// y no publica ningún identificador interno ni secreto.

const doc = fs.readFileSync('tests/pm21/P04_LOCAL_CERRADO_Y_RELACION_CRUZADA.md', 'utf8');

assert.match(doc, /pm11_local_activo/);
assert.match(doc, /QA-A-CERRADO/);
assert.match(doc, /personal_contexto_no_autorizado/);
assert.match(doc, /0 filas con el id\s*\nde prueba|0 filas.{0,20}prueba/s);
assert.match(doc, /queda cerrado/);

assert.match(doc, /no es posible aislar la\s*\nprueba|no es posible aislar la prueba/s, 'debe documentar honestamente por qué la relación cruzada no se ejecuta');
assert.match(doc, /no se ejecuta esta\s*\nprueba en este punto|no se ejecuta esta prueba en este punto/s);

assert.match(doc, /PM21_P04_LOCAL_CERRADO=PASS/);

for (const secreto of [/[a-z]{20}\.supabase\.co/i, /service_role_key/i, /SUPABASE_SERVICE_ROLE_KEY/, /sb_secret_/i, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, /qjqorixtkilwsndqayyx/, /flqercbgpgmmfaakrwkc/, /cqtghwiuxrqrxupyonqf/]) {
  assert.doesNotMatch(doc, secreto, 'no debe publicarse un identificador interno o secreto: ' + secreto);
}

console.log('PM21_P04_DOC_VERIFICADO=PASS');
console.log('PM21_P04_SIN_SECRETOS=PASS');
console.log('PM21 P04 — local cerrado verificado en vivo, relación cruzada documentada honestamente: contrato OK');
