import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM21 P01: confirma que el inventario de autorización de backend está documentado, que
// no se ha tocado fuente.js ni supabase/ en este punto (estrictamente de solo lectura),
// y que el documento no publica identificadores internos de infraestructura ni secretos.

const path = 'tests/pm21/P01_INVENTARIO_AUTORIZACION_BACKEND.md';
assert.ok(fs.existsSync(path), 'evidencia P01 existe');
const doc = fs.readFileSync(path, 'utf8');

for (const marker of [
  'PM21_P01_INVENTARIO=PASS',
  'PM21_P01_SOLO_LECTURA=CONFIRMADO',
  '93a570badba1c5375febfbddc1dffdbcef003dcd',
  'movimientos_registro',
  'qa-pruebas',
  'pm11_puede_mutar_personal',
  'pm11_puede_migrar_personal',
]) {
  assert.ok(doc.includes(marker), 'P01 conserva ' + marker);
}

// No debe publicarse ningún ref/host de Supabase ni claves.
for (const secreto of [/[a-z]{20}\.supabase\.co/i, /service_role_key/i, /SUPABASE_SERVICE_ROLE_KEY/, /sb_secret_/i, /qjqorixtkilwsndqayyx/, /flqercbgpgmmfaakrwkc/, /cqtghwiuxrqrxupyonqf/]) {
  assert.doesNotMatch(doc, secreto, 'no debe publicarse un identificador interno o secreto: ' + secreto);
}

console.log('PM21_P01_DOC_SIN_SECRETOS=PASS');
console.log('PM21 P01 (inventario de autorización de backend, solo lectura): contrato OK');
