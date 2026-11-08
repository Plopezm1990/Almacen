import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const migrationsDir = path.join(repo, 'supabase', 'migrations');

// Dry-run manifest only. It deliberately does not execute SQL or call Supabase.
// The QA-only markers are an intentional stop gate until a production-targeted
// variant has been reviewed and approved.
const migrationFiles = [
  '20261027130000_abc_f7_c07d_c05_reconcile.sql',
  '20261027131500_abc_f7_c07d_fiscal_chain_queue.sql',
  '20261027133000_abc_f7_c07d_chain_hardening.sql',
  '20261027134500_abc_f7_c07d_fk_indexes.sql',
  '20261027135000_abc_f7_c07d_entity_fk_index.sql',
  '20261027143000_abc_f7_c07d_checkout_emit_qa.sql',
  '20261027150000_abc_f7_c07d_d2_emission_config.sql',
  '20261027151000_abc_f7_c07d_d2_emission_config_fix.sql',
  '20261027152000_abc_f7_c07d_d2_adapter_scope_fix.sql',
  '20261027160000_abc_f7_c07d_d2_emission_wiring.sql',
  '20261027161000_abc_f7_c07d_d2_emission_resolver_lock_fix.sql',
  '20261027162000_abc_f7_c07d_d2_emission_config_indexes.sql',
  '20261027163000_abc_f7_c07d_d2_3_frontend_config_status.sql',
  '20261027150403_abc_f7_c07d_d3_pilot_sandbox.sql',
];

const pilotFile = '20261027150403_abc_f7_c07d_d3_pilot_sandbox.sql';
assert.equal(
  migrationFiles.at(-1),
  pilotFile,
  'el expediente D3 debe ejecutarse después de todas las piezas D2; el timestamp del archivo no es la fuente de orden'
);

const missing = migrationFiles.filter(file => !fs.existsSync(path.join(migrationsDir, file)));
assert.deepEqual(missing, [], `faltan migraciones del manifest: ${missing.join(', ')}`);

const qaOnly = migrationFiles.filter(file => {
  const source = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  return /QA-only|QA only|QA_ONLY|qa_only/i.test(source);
});

assert.ok(qaOnly.length > 0, 'el manifest debe detenerse mientras el paquete siga siendo QA-only');
assert.ok(
  migrationFiles.some(file => file.includes('checkout_emit_qa')),
  'el manifest debe identificar la emisión marcada como QA'
);
assert.ok(
  migrationFiles.some(file => file.includes('d3_pilot_sandbox')),
  'el manifest debe incluir el expediente de piloto aislado'
);

console.log(`C07D_PRODUCTION_MANIFEST_FILES=${migrationFiles.length}`);
console.log(`C07D_PRODUCTION_MANIFEST_QA_ONLY=${qaOnly.length}`);
console.log('C07D_PRODUCTION_PROMOTION=BLOCKED_UNTIL_PRODUCTION_VARIANT');
console.log('C07D_PRODUCTION_MANIFEST_CONTRACT=PASS');
