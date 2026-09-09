import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM23 P01: confirma que el documento de medición base registra métricas
// reales (p50/p95/p99/max) por operación y modo, el hallazgo arquitectónico
// de "recepción", la prueba de recuperación tras timeout, la integridad
// final, y que explícitamente NO declara un veredicto de aprobado/rechazado.
// También confirma que ni el documento ni el resultado publican
// identificadores internos ni secretos.

const doc = fs.readFileSync('tests/pm23/P01_MEDICION_BASE.md', 'utf8');
const resultado = JSON.parse(fs.readFileSync('tests/pm23/p01-resultado-medicion.json', 'utf8'));

assert.match(doc, /registrar_pago_factura/);
assert.match(doc, /registrar_devolucion_venta_pm09/);
assert.match(doc, /pm12_confirmar_ajuste_stock/);
assert.match(doc, /no\s+existe\s+ninguna\s+función/);
assert.match(doc, /SUSTITUTO de "recepción"|sustituto de "recepción"|sustituto de recepción/i);

for (const modo of ['Arranque frío', 'Concurrente × 2', 'Concurrente × 5', 'Concurrente × 10', 'Concurrente × 20', 'Secuencial × 200']) {
  assert.match(doc, new RegExp(modo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

assert.match(doc, /replayed:true|replayed: true/);
assert.match(doc, /exactamente 1 fila por identificador/);
assert.match(doc, /no declara aprobado ni rechazado/);
assert.match(doc, /PM23_P01_MEDICION_BASE=EJECUTADA_SIN_VEREDICTO/);
assert.match(doc, /Bug propio detectado y corregido/);

// El resultado real debe respaldar lo que dice el documento: 0 errores en todas
// las fases medidas, y el nivel de concurrencia 20 debe tener el tamaño de
// muestra correcto (no el bug del pool agotado detectado durante la preparación).
for (const clave of ['pago', 'ajuste', 'devolucion']) {
  const bloque = resultado[clave];
  assert.ok(bloque, `falta el bloque ${clave} en el resultado`);
  for (const nivel of bloque.niveles) {
    assert.equal(nivel.errores, 0, `errores inesperados en ${clave}/${nivel.nombre}`);
    assert.equal(nivel.n, nivel.tamañoMuestra, `tamaño de muestra incompleto en ${clave}/${nivel.nombre}`);
  }
  assert.equal(bloque.secuencial.errores, 0, `errores inesperados en ${clave}/secuencial`);
  assert.equal(bloque.secuencial.n, 200, `la muestra secuencial de ${clave} debe tener 200 llamadas reales`);
}
assert.equal(resultado.timeoutRecuperacion.efectoUnicoEnTodos, true, 'la recuperación tras timeout debe producir un efecto único en todos los intentos');
assert.equal(resultado.pago.integridad.sinDuplicados, true);
assert.equal(resultado.pago.integridad.coincide, true);

for (const secreto of [/[a-z]{20}\.supabase\.co/i, /service_role_key/i, /SUPABASE_SERVICE_ROLE_KEY/, /sb_secret_/i, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, /qjqorixtkilwsndqayyx/, /flqercbgpgmmfaakrwkc/, /cqtghwiuxrqrxupyonqf/]) {
  assert.doesNotMatch(doc, secreto, 'no debe publicarse un identificador interno o secreto en el documento: ' + secreto);
  assert.doesNotMatch(fs.readFileSync('tests/pm23/p01-resultado-medicion.json', 'utf8'), secreto, 'no debe publicarse un identificador interno o secreto en el resultado: ' + secreto);
  assert.doesNotMatch(fs.readFileSync('tests/pm23/p01-medicion-base.mjs', 'utf8'), secreto, 'no debe publicarse un identificador interno o secreto en el arnés: ' + secreto);
}

console.log('PM23_P01_DOC_VERIFICADO=PASS');
console.log('PM23_P01_RESULTADO_CONSISTENTE=PASS');
console.log('PM23_P01_SIN_SECRETOS=PASS');
console.log('PM23 P01 — medición base de red/carga/simultaneidad: contrato OK');
