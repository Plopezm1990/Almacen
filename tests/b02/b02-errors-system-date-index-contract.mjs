import assert from 'node:assert/strict';
import fs from 'node:fs';

// B-02: el historial de errores se consulta por fecha descendente y con límite.
// El contrato protege tanto la migración propuesta como la consulta que la hace
// necesaria. No prueba que la migración se haya aplicado en QA o producción.

const migrationPath = 'supabase/migrations/20261109120000_b02_errores_sistema_fecha_idx.sql';
const migration = fs.readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');

assert.match(migration, /to_regclass\('public\.errores_sistema'\)/);
assert.match(migration, /information_schema\.columns/);
assert.match(migration, /column_name = 'fecha'/);
assert.match(
  migration,
  /create\s+index\s+if\s+not\s+exists\s+errores_sistema_fecha_idx\s+on\s+public\.errores_sistema\s*\(\s*fecha\s+desc\s*\)/i,
);
assert.doesNotMatch(migration, /\b(insert|update|delete|truncate)\b/i);
console.log('B02_MIGRACION_INDICE_FECHA=PASS');

for (const sourcePath of ['fuente.js', 'source-recovery/fuente-recuperado.js']) {
  const source = fs.readFileSync(sourcePath, 'utf8').replace(/\r\n/g, '\n');
  assert.match(
    source,
    /\.from\("errores_sistema"\)\.select\("\*"\)\.order\("fecha",\s*\{\s*ascending:\s*false\s*\}\)\.limit\(100\)/,
    `${sourcePath}: la consulta debe ordenar por fecha descendente y limitar a 100`,
  );
}
console.log('B02_CONSULTA_ERRORES_ORDENADA=PASS');
console.log('B02_CONTRACT_PASS');
