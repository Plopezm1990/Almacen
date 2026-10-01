import fs from 'node:fs';
import assert from 'node:assert/strict';

const contract = fs.readFileSync('docs/plan-abc/F2_3_VERIFICACION_LOCAL_POSTGRES_2026-10-01.md', 'utf8');

for (const id of ['PG01', 'PG02', 'PG03', 'PG04', 'PG05', 'PG06', 'PG07', 'PG08', 'PG09', 'PG10', 'PG11', 'PG12']) {
  assert.match(contract, new RegExp(`\\| ${id} \\|`), `F2.3 falta ${id}`);
}
for (const term of ['template0', 'RLS', 'ACL', 'idempotencia', 'concurrencia', 'rollback', 'evidencia']) {
  assert.match(contract, new RegExp(term, 'i'), `F2.3 falta ${term}`);
}
assert.match(contract, /PREPARADO_NO_EJECUTADO/);
assert.match(contract, /no autoriza conexiones ni escrituras en QA\/PROD/i);
assert.match(contract, /continúa prohibido aplicar cambios en QA\/PROD/i);
assert.match(contract, /hacer deploy de Netlify/i);

console.log('ABC_F2_LOCAL_VERIFICATION_CONTRACT=PASS');
