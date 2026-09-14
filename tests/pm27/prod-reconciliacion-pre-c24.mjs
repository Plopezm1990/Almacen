import fs from 'node:fs';

const migrationPath = 'supabase/migrations/20260914170500_pm27_prod_reconciliacion_pre_c24.sql';
const recoveryPath = 'supabase/qa-solo/pm27_prod_recovery_pre_c24.sql';
const gatePath = 'tests/pm27/prod-reconciliacion-pg17-gate.sh';
const workflowPath = '.github/workflows/pm27-prod-reconciliacion.yml';
const baseSha = '952b6399e38dca580707b2e32211375a24adcaf5';

const sql = fs.readFileSync(migrationPath, 'utf8');
const recovery = fs.readFileSync(recoveryPath, 'utf8');
const gate = fs.readFileSync(gatePath, 'utf8');
const workflow = fs.readFileSync(workflowPath, 'utf8');

function check(name, ok) {
  console.log(`PM27_PROD_RECON_${name}=${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) process.exitCode = 1;
}

check('BASE_C25_EXACTA', workflow.includes(baseSha));
check('TRANSACCION', /^\s*--[\s\S]*?\nbegin;/i.test(sql) && /\ncommit;\s*$/i.test(sql));
check('TIMEOUTS', sql.includes("set local lock_timeout = '5s'") && sql.includes("set local statement_timeout = '30s'"));
check('FAIL_CLOSED_STOCK_CERO', sql.includes('stock_ubicacion dejó de estar vacío'));
check('FAIL_CLOSED_PARCIAL', sql.includes('tablas PM14 ya presentes/parciales') && sql.includes('marcadores C24 parciales'));
check('SIN_STAMP_MANUAL', !/insert\s+into\s+supabase_migrations\.schema_migrations/i.test(sql) && !/delete\s+from\s+supabase_migrations\.schema_migrations/i.test(sql));
check('SNAPSHOT_RECOVERY_PRIVADO', sql.includes('private.pm27_prod_recovery_20260914') && sql.includes('revoke all on table private.pm27_prod_recovery_20260914 from public, anon, authenticated'));
check('ALMACEN_SCOPE', sql.includes('alter table public.almacen_kv add column empresa_id text') && sql.includes('alter table public.almacen_kv add column local_id text'));
check('STOCK_UNIDAD', sql.includes("add column unidad text not null default 'ud'"));
check('RLS_CLIENTES', sql.includes('alter table public.clientes_empresa enable row level security') && sql.includes('clientes_empresa_update'));
check('RLS_ENCARGOS', sql.includes('alter table public.encargos_empresa enable row level security') && sql.includes('pm14_encargos_select'));
check('RLS_PAGOS', sql.includes('alter table public.pagos_encargo enable row level security') && sql.includes('pm14_pagos_encargo_select'));
check('G1_REUTILIZADO', sql.includes('execute function private.g1_claim_operation_id()') && !sql.includes('create table private.g1_operation_ids_global'));
check('SIN_LEDGERS_LEGACY_NUEVOS', !sql.includes('create table public.caja_operaciones') && !sql.includes('create table public.pagos_factura'));
check('PUENTE_FAIL_CLOSED', (sql.match(/pm27_reconciliacion_pendiente_c24/g) || []).length >= 5);
check('PAGOS_FUNCIONAL', sql.includes('create or replace function public.registrar_pago_encargo') && sql.includes('private.g1_operation_ids_global') && sql.includes("'operation_id_conflict'"));
check('REVERSO_FUNCIONAL', sql.includes('create or replace function public.revertir_pago_encargo') && sql.includes("'pago_ya_revertido'"));
check('ACL_PUBLIC_RESTRINGIDO', sql.includes('revoke all on function public.registrar_pago_encargo') && sql.includes('grant execute on function public.registrar_pago_encargo'));
check('POSTFLIGHT', sql.includes('PM27_PROD_RECON_POSTFLIGHT=PASS'));
check('RECOVERY_FAIL_CLOSED', recovery.includes('PM27_PROD_RECOVERY_ABORT') && recovery.includes('pm27_prod_recovery_20260914'));
check('RECOVERY_NO_STAMP', !/supabase_migrations\.schema_migrations/i.test(recovery));
check('GATE_C24_REAL', gate.includes('pm27_c24_preflight_migraciones.sql') && gate.includes('pm27_c24_postflight_migraciones.sql') && gate.includes('pm27-c24-migration-manifest.json'));
check('GATE_PG17', gate.includes('PM27_PROD_RECON_POSTGRES17=PASS'));
check('WORKFLOW_PINNED', workflow.includes('actions/checkout@11d5960a326750d5838078e36cf38b85af677262') && workflow.includes('actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020'));
check('WORKFLOW_NO_REMOTE_DEPLOY', !/supabase\s+(?:db\s+push|migration\s+up)|netlify\s+deploy/i.test(workflow));
check('WORKFLOW_RUNS_GATE', workflow.includes('bash tests/pm27/prod-reconciliacion-pg17-gate.sh'));
check('WORKFLOW_PROTECTED_REFS', workflow.includes('93a570badba1c5375febfbddc1dffdbcef003dcd') && workflow.includes('a97740987be57aa9646f6a06e69b2230f140ec5f'));

if (process.exitCode) throw new Error('PM27_PROD_RECON_STATIC_FAIL');
console.log('PM27_PROD_RECON_STATIC=PASS');
