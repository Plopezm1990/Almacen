import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const file = path.join(repo, 'supabase', 'production-migrations', '001_c07d_infrastructure_variant.sql');
const source = fs.readFileSync(file, 'utf8');

assert.match(source, /C07-D Paso maestro 3/);
assert.match(source, /set local lock_timeout/);
assert.match(source, /set local statement_timeout/);
assert.match(source, /create table public\.abc_c07d_registros_fiscales/);
assert.match(source, /create table public\.abc_c07d_cola_fiscal/);
assert.match(source, /create table private\.abc_c07d_adaptadores_fiscales/);
assert.match(source, /create table private\.abc_c07d_emision_config/);
assert.match(source, /create table private\.abc_c07d_pilotos_sandbox/);
assert.match(source, /DISABLED/);
assert.match(source, /qa_only/);
assert.doesNotMatch(source, /insert\s+into\s+private\.abc_c07d_adaptadores_fiscales\s*\([\s\S]*?SIMULADOR_C07D/i);
assert.doesNotMatch(source, /QA-EMP-A/i);
assert.doesNotMatch(source, /-----BEGIN [A-Z ]+PRIVATE KEY-----/i);

const order = [
  '20261027130000_abc_f7_c07d_c05_reconcile.sql',
  '20261027131500_abc_f7_c07d_fiscal_chain_queue.sql',
  '20261027143000_abc_f7_c07d_checkout_emit_qa.sql',
  '20261027150000_abc_f7_c07d_d2_emission_config.sql',
  '20261027160000_abc_f7_c07d_d2_emission_wiring.sql',
  '20261027150403_abc_f7_c07d_d3_pilot_sandbox.sql',
];
let previous = -1;
for (const name of order) {
  const position = source.indexOf(`BEGIN ${name}`);
  assert.ok(position > previous, `orden de variante incorrecto: ${name}`);
  previous = position;
}

console.log('C07D_PRODUCTION_VARIANT_NO_QA_DATA=PASS');
console.log('C07D_PRODUCTION_VARIANT_TRANSPORT_DISABLED=PASS');
console.log('C07D_PRODUCTION_VARIANT_SECURITY_GATES=PASS');
console.log('C07D_PRODUCTION_VARIANT_CONTRACT=PASS');

