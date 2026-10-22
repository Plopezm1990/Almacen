import fs from 'node:fs';

const file = 'supabase/migrations/20260915152000_pm27_restore_c24_operational_rpcs.sql';
const sql = fs.readFileSync(file, 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const targets = [
  'registrar_venta_stock',
  'registrar_venta_stock_carrito',
  'trasladar_stock_interno',
  'trasladar_stock_entre_locales',
  'registrar_encargo',
];

assert(/^begin;/mi.test(sql) && /^commit;/mi.test(sql), 'migration must be transactional');
assert(sql.includes("set local lock_timeout = '5s'"), 'lock_timeout missing');
assert(sql.includes("set local statement_timeout = '30s'"), 'statement_timeout missing');
assert(sql.includes('PM27_RPC_RESTORE_PREFLIGHT=PASS'), 'preflight marker missing');
assert(sql.includes('PM27_RPC_RESTORE_POSTFLIGHT=PASS'), 'postflight marker missing');

const created = [...sql.matchAll(/create\s+or\s+replace\s+function\s+public\.([a-zA-Z0-9_]+)\s*\(/gi)].map(m => m[1]);
assert(created.length === targets.length, `expected ${targets.length} restored functions, got ${created.length}`);
assert(JSON.stringify([...created].sort()) === JSON.stringify([...targets].sort()),
  `unexpected function scope: ${created.join(',')}`);

for (const name of targets) {
  assert(sql.includes(`public.${name}`), `missing target ${name}`);
}

for (const forbidden of [
  /create\s+table\b/i,
  /alter\s+table\b/i,
  /drop\s+table\b/i,
  /create\s+policy\b/i,
  /drop\s+policy\b/i,
  /create\s+trigger\b/i,
  /alter\s+role\b/i,
  /supabase_migrations\.schema_migrations/i,
  /service_role/i,
]) {
  assert(!forbidden.test(sql), `forbidden scope matched: ${forbidden}`);
}

assert(sql.includes('pm09_bloquear_operation_id_stock'), 'global stock operation_id guard missing');
assert(sql.includes('movimientos_datos_norm=lineas_datos_norm'), 'C23 cart replay guard missing');
assert(sql.includes('unidad_incompatible'), 'inter-local unit compatibility guard missing');
assert(sql.includes('cliente_otro_contexto'), 'cross-tenant customer guard missing');
assert(sql.includes('transicion_encargo_invalida'), 'encargo state machine guard missing');
assert(sql.includes('encargos_empresa') && sql.includes("has_table_privilege('authenticated','public.encargos_empresa','INSERT')"),
  'encargos direct-write ACL guard missing');

for (const name of targets) {
  const revoke = new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${name}\\(`, 'i');
  const grant = new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${name}\\(`, 'i');
  assert(revoke.test(sql), `revoke-all missing for ${name}`);
  assert(grant.test(sql), `authenticated grant missing for ${name}`);
}

// The fail-closed marker is allowed only in pre/postflight detection and comments;
// no restored function body may raise it.
assert(!/begin\s+raise\s+exception\s+'pm27_reconciliacion_pendiente_c24'/i.test(sql),
  'a restored function still contains the fail-closed stub');

console.log('PM27_RPC_RESTORE_STATIC=PASS');
