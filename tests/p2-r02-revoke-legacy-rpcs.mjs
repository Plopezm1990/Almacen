import fs from 'node:fs';

const file = 'supabase/migrations/20260916054000_p2_r02_revocar_exec_rpcs_legacy.sql';
const sql = fs.readFileSync(file, 'utf8');
const executableSql = sql
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/--.*$/gm, '');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const expectedTargets = [
  'public.descontar_stock_carrito(jsonb, text)',
  'public.anular_venta_tpv(text, text)',
];

assert(/^begin;/mi.test(executableSql), 'migration must start a transaction');
assert(/^commit;/mi.test(executableSql), 'migration must commit explicitly');
assert(/set\s+local\s+lock_timeout\s*=\s*'5s'/i.test(executableSql), 'lock_timeout missing');
assert(/set\s+local\s+statement_timeout\s*=\s*'30s'/i.test(executableSql), 'statement_timeout missing');
assert(executableSql.includes('P2-R02 PREFLIGHT_FALLO'), 'strict preflight marker missing');
assert(executableSql.includes('P2-R02 POSTFLIGHT_FALLO'), 'strict postflight marker missing');

for (const target of expectedTargets) {
  const normalized = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/,\s+/g, ',\\s*');
  const revoke = new RegExp(`revoke\\s+execute\\s+on\\s+function\\s+${normalized}\\s+from\\s+authenticated\\s*;`, 'i');
  assert(revoke.test(executableSql), `missing exact authenticated revoke for ${target}`);
}

const revokes = [...executableSql.matchAll(/revoke\s+[^;]+;/gi)].map(m => m[0]);
assert(revokes.length === 2, `expected exactly 2 REVOKE statements, got ${revokes.length}`);

const forbidden = [
  /\bgrant\b/i,
  /create\s+(?:or\s+replace\s+)?function\b/i,
  /alter\s+function\b/i,
  /drop\s+function\b/i,
  /create\s+table\b/i,
  /alter\s+table\b/i,
  /drop\s+table\b/i,
  /create\s+policy\b/i,
  /alter\s+policy\b/i,
  /drop\s+policy\b/i,
  /create\s+trigger\b/i,
  /drop\s+trigger\b/i,
  /create\s+schema\b/i,
  /alter\s+role\b/i,
  /\btruncate\b/i,
  /\binsert\s+into\b/i,
  /\bupdate\s+[a-z_]/i,
  /\bdelete\s+from\b/i,
  /supabase_migrations\.schema_migrations/i,
  /service_role/i,
];

for (const pattern of forbidden) {
  assert(!pattern.test(executableSql), `forbidden migration scope matched: ${pattern}`);
}

assert(!/revoke\s+[^;]+\s+from\s+(?:public|anon|service_role)\b/i.test(executableSql),
  'migration must not change PUBLIC/anon/service_role ACLs');
assert(!/obtener_contexto_operativo\s*\(/i.test(executableSql),
  'obtener_contexto_operativo must remain out of migration scope');

for (const signature of [
  "to_regprocedure('public.descontar_stock_carrito(jsonb,text)')",
  "to_regprocedure('public.anular_venta_tpv(text,text)')",
]) {
  assert(executableSql.includes(signature), `exact signature pre/postflight missing: ${signature}`);
}

console.log('P2_R02_STATIC=PASS');
