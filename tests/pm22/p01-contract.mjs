import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM22 P01: confirma que el documento de cierre registra el resultado real de
// la suite (61/61, 5 viewports), el bloqueo explícito de dispositivo físico
// (nunca presentado como "validado en Android/iOS reales"), y que no publica
// ningún identificador interno ni secreto.

const doc = fs.readFileSync('tests/pm22/P01_MOVIL_ACCESIBILIDAD_CHECKPOINT.md', 'utf8');

assert.match(doc, /61\/61/);
assert.match(doc, /360×800/);
assert.match(doc, /390×844/);
assert.match(doc, /844×390/);
assert.match(doc, /768×1024/);
assert.match(doc, /1440×900/);

assert.match(doc, /cobertura emulada/i);
assert.match(doc, /nunca (presentarla|se presenta)/i, 'debe dejar explícito que la emulación no sustituye dispositivos físicos');
assert.match(doc, /Android\/Chrome real e iPhone\/Safari real/);
assert.match(doc, /teclado virtual/i);
assert.match(doc, /Gestos táctiles/);
assert.match(doc, /[ÁáA]reas seguras/);

assert.match(doc, /Corrección de método/);
assert.match(doc, /page\.accessibility\.snapshot/);

assert.match(doc, /PM22_P01_COBERTURA_EMULADA=CERRADA/);
assert.match(doc, /PM22_P01_DISPOSITIVOS_FISICOS=BLOQUEADO_SIN_HARDWARE/);

assert.ok(fs.existsSync('tests/pm22/p01-movil-accesibilidad.mjs'), 'la suite real debe estar trackeada');
const suite = fs.readFileSync('tests/pm22/p01-movil-accesibilidad.mjs', 'utf8');
assert.match(suite, /accessibility\.snapshot/, 'la suite debe usar el árbol de accesibilidad real, no una heurística de atributos');

for (const secreto of [/[a-z]{20}\.supabase\.co/i, /service_role_key/i, /SUPABASE_SERVICE_ROLE_KEY/, /sb_secret_/i, /qjqorixtkilwsndqayyx/, /flqercbgpgmmfaakrwkc/, /cqtghwiuxrqrxupyonqf/]) {
  assert.doesNotMatch(doc + suite, secreto, 'no debe publicarse un identificador interno o secreto: ' + secreto);
}

console.log('PM22_P01_DOC_VERIFICADO=PASS');
console.log('PM22_P01_SIN_SECRETOS=PASS');
console.log('PM22 P01 — móvil y accesibilidad (cobertura emulada): contrato OK');
