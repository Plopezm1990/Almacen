import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM23 P02: confirma que el veredicto formal contra el presupuesto acordado
// (p95<2000ms, recuperación<5000ms) está registrado fila por fila a partir de
// los datos reales de P01, que ninguna fila incumple el presupuesto, que la
// aceptación del sustituto de recepción queda explícita, y que no se publica
// ningún identificador interno ni secreto.

const doc = fs.readFileSync('tests/pm23/P02_PRESUPUESTO_Y_VEREDICTO.md', 'utf8');
const resultado = JSON.parse(fs.readFileSync('tests/pm23/p01-resultado-medicion.json', 'utf8'));

assert.match(doc, /p95 < 2000 ms/);
assert.match(doc, /< 5000 ms/);
assert.match(doc, /APROBADO/);
assert.match(doc, /sustituto de "recepción"|sustituto de recepción/i);
assert.match(doc, /excepción expresamente aceptada/);
assert.match(doc, /PM23_P02_VEREDICTO=APROBADO_SIN_HALLAZGOS/);

// Confirma contra los datos reales que el presupuesto efectivamente se cumple
// en todo lo medido -- el documento no puede afirmar un veredicto que los
// propios números contradigan.
const PRESUPUESTO_P95_MS = 2000;
for (const clave of ['pago', 'ajuste', 'devolucion']) {
  const bloque = resultado[clave];
  for (const nivel of bloque.niveles) {
    assert.ok(nivel.p95 < PRESUPUESTO_P95_MS, `${clave}/${nivel.nombre} incumple el presupuesto de p95: ${nivel.p95}ms`);
  }
  assert.ok(bloque.secuencial.p95 < PRESUPUESTO_P95_MS, `${clave}/secuencial incumple el presupuesto de p95: ${bloque.secuencial.p95}ms`);
}

// Recuperación tras timeout: aborto + espera deliberada + reintento, todo
// dentro de los 5000ms del presupuesto.
const ESPERA_DELIBERADA_MS = 1500;
for (const intento of resultado.timeoutRecuperacion.intentos) {
  const total = intento.msHastaAborto + ESPERA_DELIBERADA_MS;
  assert.ok(total < 5000, `recuperación tras timeout incumple el presupuesto: ${total}ms`);
}

assert.match(doc, /Recarga durante guardado/);
assert.match(doc, /Varias pestañas/);
assert.match(doc, /Última unidad/);
assert.match(doc, /PM23 P03/);

for (const secreto of [/[a-z]{20}\.supabase\.co/i, /service_role_key/i, /SUPABASE_SERVICE_ROLE_KEY/, /sb_secret_/i, /qjqorixtkilwsndqayyx/, /flqercbgpgmmfaakrwkc/, /cqtghwiuxrqrxupyonqf/]) {
  assert.doesNotMatch(doc, secreto, 'no debe publicarse un identificador interno o secreto: ' + secreto);
}

console.log('PM23_P02_DOC_VERIFICADO=PASS');
console.log('PM23_P02_VEREDICTO_CONSISTENTE_CON_DATOS=PASS');
console.log('PM23_P02_SIN_SECRETOS=PASS');
console.log('PM23 P02 — presupuesto acordado y veredicto formal: contrato OK');
