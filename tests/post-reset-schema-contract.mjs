import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260915132000_post_reset_schema_contract_repair.sql';
const migration = fs.readFileSync(migrationPath, 'utf8');
const fuente = fs.readFileSync('fuente.js', 'utf8');

function must(re, message) {
  assert.match(migration, re, message);
}

// Scope: forward-only contract repair, no helper body replacement and no data DML.
must(/\bbegin\s*;/i, 'migration must be transactional');
must(/set local lock_timeout\s*=\s*'5s'/i, 'lock_timeout guard missing');
must(/set local statement_timeout\s*=\s*'30s'/i, 'statement_timeout guard missing');
assert.doesNotMatch(migration, /create\s+or\s+replace\s+function\s+private\.la_tiene_(?:empresa|local)/i,
  'helper bodies must not be replaced');
assert.doesNotMatch(migration, /\binsert\s+into\b|\bdelete\s+from\b|\bupdate\s+public\./i,
  'repair must not mutate business data');
assert.doesNotMatch(migration, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  'migration must not hardcode user/company IDs');

// RLS helper callable contract.
must(/alter function private\.la_tiene_empresa\(text\)\s+set search_path to public, auth, private, pg_temp/i,
  'empresa helper search_path repair missing');
must(/alter function private\.la_tiene_local\(text, text\)\s+set search_path to public, auth, private, pg_temp/i,
  'local helper search_path repair missing');
must(/grant execute on function private\.la_tiene_empresa\(text\) to authenticated/i,
  'authenticated EXECUTE for empresa helper missing');
must(/grant execute on function private\.la_tiene_local\(text, text\) to authenticated/i,
  'authenticated EXECUTE for local helper missing');
must(/revoke all on function private\.la_tiene_empresa\(text\) from public, anon/i,
  'empresa helper must remain unavailable to anon/PUBLIC');
must(/revoke all on function private\.la_tiene_local\(text, text\) from public, anon/i,
  'local helper must remain unavailable to anon/PUBLIC');

// Exact active PM07 stock view contract.
must(/create or replace view public\.stock_estado\s+with \(security_invoker = true\)/i,
  'stock_estado must be SECURITY INVOKER');
for (const token of [
  'empresa_id', 'local_id', 'producto_id', 'almacen', 'piso',
  'round(almacen + piso, 6) as total', 'minimo',
  'round(almacen + piso, 6) < minimo as bajo_minimo',
  'fraccionable', 'precision_cantidad', 'updated_at', 'local_operable'
]) {
  assert.ok(migration.toLowerCase().includes(token.toLowerCase()), `stock view token missing: ${token}`);
}
must(/from public\.stock_ubicacion/i, 'stock_estado must project stock_ubicacion');
must(/revoke all on public\.stock_estado from public, anon, authenticated/i,
  'stock_estado must not inherit broad client grants');
must(/grant select on public\.stock_estado to authenticated/i,
  'authenticated SELECT on stock_estado missing');
assert.doesNotMatch(migration, /grant\s+(?:all|insert|update|delete|truncate).*stock_estado\s+to\s+authenticated/i,
  'authenticated must not receive write privileges on stock_estado');

// Runtime proof: this is not dead schema. Current deployed source reads the view
// and refreshes it in more than one operational path.
assert.match(fuente, /supabase\.from\("stock_estado"\)\.select\(/,
  'fuente.js no longer reads stock_estado');
const syncCalls = fuente.match(/sincronizarStockPm07\s*\(/g) || [];
assert.ok(syncCalls.length >= 3,
  `expected active sincronizarStockPm07 call-sites, got ${syncCalls.length}`);

// Postflight must verify least privilege and security_invoker inside the same migration.
must(/has_function_privilege\('authenticated', 'private\.la_tiene_empresa\(text\)', 'EXECUTE'\)/i,
  'empresa helper postflight missing');
must(/has_table_privilege\('authenticated', 'public\.stock_estado', 'SELECT'\)/i,
  'stock view postflight missing');
must(/security_invoker=true/i, 'security_invoker postflight missing');
must(/\bcommit\s*;/i, 'migration must commit explicitly');

console.log('PASS post-reset schema contract: narrow repair + active stock dependency + least privilege');
