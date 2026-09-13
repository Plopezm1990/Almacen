import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM21 P03: confirma que el documento de cierre registra las 12 verificaciones reales
// (login + RLS + rol + Storage) con resultado PASS, la corrección de método sobre la
// identidad inactiva, y que no publica ningún identificador interno ni secreto.

const doc = fs.readFileSync('tests/pm21/P03_MATRIZ_IDENTIDADES_QA.md', 'utf8');

assert.match(doc, /ya existía/, 'debe documentar que la identidad inactiva ya existía');
assert.match(doc, /inactive@qa\.invalid/);
assert.match(doc, /Corrección de método/);

for (const email of ['owner.a@qa.invalid', 'owner.b@qa.invalid', 'operator.a1@qa.invalid', 'operator.a2@qa.invalid', 'pm11.smoke.a1@la-suite.test']) {
  assert.match(doc, new RegExp(email.replace(/[.@]/g, '\\$&')));
}

assert.match(doc, /12\/12 verificaciones correctas/);
const filas = doc.match(/\| PASS \|/g) || [];
assert.ok(filas.length >= 12, 'deben registrarse al menos 12 verificaciones PASS en la tabla');

assert.match(doc, /service_role/i);
assert.match(doc, /nunca (se|para) (ejecutar|usó)|nunca con `service_role`/, 'debe dejar constancia de que service_role no se usó para las pruebas en sí');
assert.match(doc, /0 filas\/objetos\s*\nresiduales|0 filas.{0,20}residuales/s, 'debe confirmar que no quedó ningún dato de prueba residual');

assert.match(doc, /PM21_P03_MATRIZ_IDENTIDADES=PASS/);

for (const secreto of [/[a-z]{20}\.supabase\.co/i, /service_role_key/i, /SUPABASE_SERVICE_ROLE_KEY/, /sb_secret_/i, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, /qjqorixtkilwsndqayyx/, /flqercbgpgmmfaakrwkc/, /cqtghwiuxrqrxupyonqf/]) {
  assert.doesNotMatch(doc, secreto, 'no debe publicarse un identificador interno o secreto: ' + secreto);
}

console.log('PM21_P03_DOC_VERIFICADO=PASS');
console.log('PM21_P03_SIN_SECRETOS=PASS');
console.log('PM21 P03 — matriz de identidades QA reales: contrato OK');
