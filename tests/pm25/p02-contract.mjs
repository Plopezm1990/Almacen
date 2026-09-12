import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM25 P02: NO certifica ejecución -- certifica que el estado de bloqueo
// está registrado con precisión, que el diseño del ensayo se conservó
// íntegro, que las condiciones de desbloqueo están documentadas, y que no
// se afirma en ningún sitio que P02 se haya ejecutado/aprobado/cerrado ni
// que se haya tocado QA compartido, producción o TPV.

const doc = fs.readFileSync('tests/pm25/P02_BLOQUEADO_ENTORNO_AISLADO.md', 'utf8');
const estado = fs.readFileSync('tests/pm25/ESTADO_PM25.md', 'utf8');

// --- El estado de bloqueo es inequívoco ---
assert.match(doc, /BLOQUEADO POR FALTA DE ENTORNO AISLADO/);
assert.match(doc, /PM25_P02_ESTADO=BLOQUEADO_POR_FALTA_DE_ENTORNO_AISLADO/);
assert.match(doc, /PM25_P02_EJECUTADO=NO/);
assert.match(doc, /PM25_P02_APROBADO=NO/);
assert.match(doc, /PM25_P02_DESCARTADO=NO/);
assert.match(doc, /PM25_P02_CERRADO=NO/);
assert.match(estado, /PARCIAL\s*\/\s*BLOQUEADO/);

// --- El motivo exacto del bloqueo está documentado (no un fallo genérico) ---
assert.match(doc, /Branching\s+is\s+supported\s+only\s+on\s+the\s+Pro\s+plan\s+or\s+above/);
assert.match(doc, /plan Free de Supabase permite un\s+m[áa]ximo de 2 proyectos activos/);

// --- Ninguna acción prohibida se afirma como realizada ---
assert.match(doc, /No se cre[óo] ninguna \*branch\* ni proyecto Supabase/);
assert.match(doc, /No se paus[óo], reactiv[óo] ni modific[óo] `TPV`, producci[óo]n ni QA/);
assert.match(doc, /No se subi[óo] ning[úu]n plan de pago/);
assert.match(doc, /No se us[óo] `service_role`/);

// --- El diseño del ensayo se conservó íntegro para cuando exista entorno ---
assert.match(doc, /g1_p08_operation_id_finanzas_global\.sql/);
assert.match(doc, /operation_id.{0,40}repetido a prop[óo]sito entre dos libros distintos/is);
assert.match(doc, /nunca\s+simulada\s+con\s+`DROP`\s+manual/i);
assert.match(doc, /< 5 minutos, 0 filas perdidas, 0 duplicados/);

// --- Las tres condiciones de desbloqueo están documentadas ---
assert.match(doc, /proyecto Supabase aislado, sin coste/);
assert.match(doc, /autorizaci[óo]n expresa y espec[íi]fica para un entorno aislado de pago/i);
assert.match(doc, /entorno local con el stack completo de Supabase/);
assert.match(doc, /PostgreSQL local sin el resto del stack puede aportar evidencia parcial.{0,120}pero no puede\s+cerrar P02/is);

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
  assert.doesNotMatch(estado, patron, 'no debe publicarse un identificador interno o secreto en el estado: ' + patron);
}

console.log('PM25_P02_DOC_BLOQUEO_VERIFICADO=PASS');
console.log('PM25_P02_SIN_SECRETOS=PASS');
console.log('PM25 P02 — bloqueado por falta de entorno aislado: contrato de estado OK (no certifica ejecución)');
