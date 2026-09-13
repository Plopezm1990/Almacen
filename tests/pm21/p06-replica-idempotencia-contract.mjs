import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM21 P06: confirma que el documento registra la réplica real de idempotencia
// contra QA (dos llamadas HTTP idénticas, un solo efecto lógico), el checkpoint
// de cierre de PM21, y que no publica ningún identificador interno ni secreto.

const doc = fs.readFileSync('tests/pm21/P06_REPLICA_IDEMPOTENCIA_HTTP_QA.md', 'utf8');

assert.match(doc, /pm12_confirmar_ajuste_stock/);
assert.match(doc, /QA-PROD-A-AGUA/);
assert.match(doc, /replayed: false/);
assert.match(doc, /replayed: true/);
assert.match(doc, /Efecto lógico único confirmado/);
assert.match(doc, /sin duplicados/i);
assert.match(doc, /no se usó ninguna transacción de base de datos[\s\S]{0,20}revertida/, 'debe documentar que no se usó ROLLBACK');
assert.match(doc, /auditoria_registro/);
assert.match(doc, /0 filas relacionadas/);

// Checkpoint de cierre de PM21: la tabla debe listar todos los elementos de P01.
for (const elemento of ['movimientos_registro', 'Storage', 'pagos_encargo', 'albaranes_empresa', 'Local cerrado', 'Relación cruzada', 'idempotencia']) {
  assert.match(doc, new RegExp(elemento));
}
assert.match(doc, /PM21 queda formalmente cerrado/);
assert.match(doc, /PM21_P06_REPLICA_IDEMPOTENCIA=PASS/);
assert.match(doc, /PM21_CIERRE_FORMAL=PASS/);

for (const secreto of [/[a-z]{20}\.supabase\.co/i, /service_role_key/i, /SUPABASE_SERVICE_ROLE_KEY/, /sb_secret_/i, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, /qjqorixtkilwsndqayyx/, /flqercbgpgmmfaakrwkc/, /cqtghwiuxrqrxupyonqf/]) {
  assert.doesNotMatch(doc, secreto, 'no debe publicarse un identificador interno o secreto: ' + secreto);
}

console.log('PM21_P06_DOC_VERIFICADO=PASS');
console.log('PM21_P06_SIN_SECRETOS=PASS');
console.log('PM21 P06 — réplica de idempotencia por HTTP real contra QA: contrato OK');
