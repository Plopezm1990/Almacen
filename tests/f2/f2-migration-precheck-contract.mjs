import fs from 'node:fs';
import assert from 'node:assert/strict';

const precheck = fs.readFileSync('docs/plan-abc/F2_4_PRECHECK_MIGRACION_CANDIDATA_2026-10-01.md', 'utf8');

assert.match(precheck, /BLOQUEADO_HERRAMIENTA_LOCAL/);
assert.match(precheck, /Supabase CLI no está disponible/i);
assert.match(precheck, /No se ha creado una migración nueva/i);
assert.match(precheck, /No se ha ejecutado `supabase db push`/i);
assert.match(precheck, /supabase migration new/i);
assert.match(precheck, /RLS, políticas, grants y revisión de Data\s+API/i);
assert.match(precheck, /no corresponde\s+crear ni aplicar una migración/i);

console.log('ABC_F2_MIGRATION_PRECHECK=PASS_WITH_LOCAL_BLOCK');
