import fs from 'node:fs';
import assert from 'node:assert/strict';

const manifest = fs.readFileSync('docs/plan-abc/F2_6_MANIFIESTO_RECUPERACION_CANDIDATO_2026-10-01.md', 'utf8');

for (const term of ['Identidad del candidato', 'SHA de base', 'Hash de migración SQL', 'Resultado advisors', 'Resultado PG01–PG12', 'Contenido que se debe adjuntar', 'Recuperación segura', 'Puerta de autorización']) {
  assert.match(manifest, new RegExp(term, 'i'), `F2.6 falta ${term}`);
}
assert.match(manifest, /PLANTILLA_PENDIENTE_CANDIDATO/);
assert.match(manifest, /La autorización de\s+QA no implica autorización de PROD/i);
assert.match(manifest, /no se toca QA\/PROD/i);
assert.match(manifest, /no\s+se hace deploy de Netlify/i);

console.log('ABC_F2_CANDIDATE_MANIFEST=PASS_WITH_PENDING_CANDIDATE');
