import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const migration = readFileSync(join(REPO, 'supabase/migrations/20261110190000_m01_enable_pin_rls.sql'), 'utf8');

assert.match(migration, /alter table private\.pm11_empleado_pin enable row level security/);
assert.match(migration, /c\.relrowsecurity/);
assert.doesNotMatch(migration, /\b(insert|update|delete|truncate)\b/i);

console.log('M01_PIN_RLS_CONTRACT=PASS');
