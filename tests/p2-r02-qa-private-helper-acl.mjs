import fs from 'node:fs';

const file = 'supabase/migrations/20260916040900_p2_r02_qa_alinear_acl_helpers_privados.sql';
const sql = fs.readFileSync(file, 'utf8');
const executableSql = sql
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/--.*$/gm, '');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const closed = [
  'private.pm06_proteger_identidad_y_total()',
  'private.pm06_proyectar_gasto_factura()',
  'private.pm06_total_factura(text,text,text,text)',
  'private.pm06_validar_proveedor_compatible()',
  'private.pm07_puede_gestionar_stock()',
  'private.pm07_puede_vender()',
  'private.pm14_total_encargo(text,text,text)',
];
const finance = 'private.pm06_puede_gestionar_finanzas()';

assert(/^begin;/mi.test(executableSql), 'QA migration must start a transaction');
assert(/^commit;/mi.test(executableSql), 'QA migration must commit explicitly');
assert(/set\s+local\s+lock_timeout\s*=\s*'5s'/i.test(executableSql), 'QA lock_timeout missing');
assert(/set\s+local\s+statement_timeout\s*=\s*'30s'/i.test(executableSql), 'QA statement_timeout missing');
assert(executableSql.includes('P2-R02 QA PREFLIGHT_FALLO'), 'QA strict preflight marker missing');
assert(executableSql.includes('P2-R02 QA POSTFLIGHT_FALLO'), 'QA strict postflight marker missing');

for (const target of [...closed, finance]) {
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/,/g, ',\\s*');
  const revoke = new RegExp(`revoke\\s+execute\\s+on\\s+function\\s+${escaped}\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated\\s*;`, 'i');
  assert(revoke.test(executableSql), `missing full client revoke for ${target}`);
}

const grantFinance = /grant\s+execute\s+on\s+function\s+private\.pm06_puede_gestionar_finanzas\s*\(\s*\)\s+to\s+authenticated\s*;/i;
assert(grantFinance.test(executableSql), 'finance helper authenticated grant missing');

const grants = [...executableSql.matchAll(/grant\s+execute\s+on\s+function\s+[^;]+;/gi)].map(m => m[0]);
assert(grants.length === 1, `expected exactly one GRANT EXECUTE, got ${grants.length}`);

const revokes = [...executableSql.matchAll(/revoke\s+execute\s+on\s+function\s+[^;]+;/gi)].map(m => m[0]);
assert(revokes.length === 8, `expected exactly 8 REVOKE EXECUTE statements, got ${revokes.length}`);

for (const forbidden of [
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
  /service_role/i,
  /descontar_stock_carrito/i,
  /anular_venta_tpv/i,
]) {
  assert(!forbidden.test(executableSql), `forbidden QA migration scope matched: ${forbidden}`);
}

console.log('P2_R02_QA_STATIC=PASS');
