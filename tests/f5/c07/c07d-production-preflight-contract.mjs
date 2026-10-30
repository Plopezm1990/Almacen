import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const file = path.join(repo, 'supabase', 'production-migrations', '000_c07d_production_preflight.sql');
const source = fs.readFileSync(file, 'utf8');
const executable = source
  .split(/\r?\n/)
  .filter(line => !line.trim().startsWith('--'))
  .join('\n');

assert.match(source, /C07-D production preflight/i);
assert.match(source, /to_regclass\('public\.locales'\)/);
assert.match(source, /C07D_PRODUCTION_PREFLIGHT_MISSING_BASE/);
assert.match(source, /C07D_PRODUCTION_PREFLIGHT_PARTIAL_STATE/);
assert.match(source, /C07D_PRODUCTION_PREFLIGHT_REAL_ACTIVATION_PRESENT/);
assert.match(source, /raise notice 'C07D_PRODUCTION_PREFLIGHT=PASS'/);

for (const statement of ['insert', 'update', 'delete', 'create', 'alter', 'drop', 'grant', 'revoke']) {
  assert.doesNotMatch(
    executable,
    new RegExp(`^\\s*${statement}\\b`, 'im'),
    `el preflight no puede ejecutar ${statement.toUpperCase()}`
  );
}

console.log('C07D_PRODUCTION_PREFLIGHT_READ_ONLY=PASS');
console.log('C07D_PRODUCTION_PREFLIGHT_CONTRACT=PASS');
