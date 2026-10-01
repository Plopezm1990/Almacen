import fs from 'node:fs';
import assert from 'node:assert/strict';

const gate = fs.readFileSync('docs/plan-abc/F2_5_PUERTA_REVISION_MIGRACION_2026-10-01.md', 'utf8');

for (const term of ['Checklist del paquete', 'RLS', 'ACL', 'PG01–PG12', 'Advisors', 'Reconstrucción', 'Compatibilidad', 'Reversión', 'Hash', 'Autorización']) {
  assert.match(gate, new RegExp(term, 'i'), `F2.5 falta ${term}`);
}
assert.match(gate, /PENDIENTE_HERRAMIENTA_Y_REVISION/);
assert.match(gate, /Criterios de rechazo/);
assert.match(gate, /Prueba solo en PGlite presentada como PostgreSQL real/i);
assert.match(gate, /No se crea SQL, no se\s+aplica migración/i);
assert.match(gate, /no se toca QA\/PROD/i);

console.log('ABC_F2_MIGRATION_GATE=PASS_WITH_BLOCK');
