import fs from 'node:fs';
import assert from 'node:assert/strict';

const evidence = fs.readFileSync('docs/plan-abc/F2_3_EVIDENCIA_PGLITE_FALLBACK_2026-10-01.md', 'utf8');

assert.match(evidence, /AUXILIAR_PASS_POSTGRES_PENDIENTE/);
assert.match(evidence, /Docker CLI: no disponible/i);
assert.match(evidence, /`psql`: no disponible/i);
assert.match(evidence, /A09_PGLITE_FUNCTIONAL=PASS/);
assert.match(evidence, /no demuestra la compatibilidad\s+completa con PostgreSQL\/Supabase/i);
assert.match(evidence, /PG01–PG12\s+continúan `PENDIENTE`/i);
assert.match(evidence, /No se requiere tocar QA\/PROD/i);

console.log('ABC_F2_LOCAL_EVIDENCE=PASS_WITH_LIMITATION');
