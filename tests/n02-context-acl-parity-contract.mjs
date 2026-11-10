import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const migration = readFileSync(
  join(repo, 'supabase/migrations/20261110200000_n02_context_acl_parity.sql'),
  'utf8'
);
const reconcile = readFileSync(
  join(repo, 'supabase/migrations/20261108193000_n02_reconcile_deployed_db_functions.sql'),
  'utf8'
);

assert.match(migration, /revoke all on function public\.obtener_contexto_operativo\(text\) from service_role/i);
assert.match(migration, /grant execute on function public\.obtener_contexto_operativo\(text\) to authenticated/i);
assert.doesNotMatch(migration, /grant execute on function public\.obtener_contexto_operativo\(text\) to service_role/i);
assert.match(reconcile, /grant execute on function public\.obtener_contexto_operativo\(text\) to authenticated/i);

console.log('N02_CONTEXT_ACL_PARITY_CONTRACT=PASS');
