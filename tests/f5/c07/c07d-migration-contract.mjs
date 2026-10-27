import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const reconcile = fs.readFileSync(path.join(root, 'supabase/migrations/20261027130000_abc_f7_c07d_c05_reconcile.sql'), 'utf8');
const chain = fs.readFileSync(path.join(root, 'supabase/migrations/20261027131500_abc_f7_c07d_fiscal_chain_queue.sql'), 'utf8');
const hardening = fs.readFileSync(path.join(root, 'supabase/migrations/20261027133000_abc_f7_c07d_chain_hardening.sql'), 'utf8');
const cleanFixture = JSON.parse(fs.readFileSync(
  path.join(root, 'tests/f5/c07/fixtures/c05-reconciliacion-limpia.json'),
  'utf8',
));

for (const marker of [
  'entidad_fiscal_id uuid',
  'ABC_F7_C07D_C05_RECONCILE_AMBIGUO',
  'abc_c05_serie_entidad_scope_key',
  'abc_c05_documento_entidad_numero_uq',
  'private.abc_c05_entidad_para_local',
  'abc_configurar_serie_documental',
  'abc_reservar_numero_documental',
]) assert.match(reconcile, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), marker);

for (const marker of [
  'abc_c07d_registros_fiscales',
  'abc_c07d_cola_fiscal',
  'hash_anterior_sha256',
  'extensions.digest',
  'abc_c07d_registrar_documento_fiscal',
  'abc_c07d_reclamar_cola_fiscal',
  'abc_c07d_resolver_cola_fiscal',
  'registro_fiscal_inmutable',
  'enable row level security',
  'No realiza llamadas a AEAT',
]) assert.match(chain, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), marker);

for (const marker of [
  'pg_advisory_xact_lock',
  'hashtextextended',
  'registro_fiscal_requiere_documento_emitido',
  'abc_c07d_registro_chain_lock',
]) assert.match(chain + hardening, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), marker);

assert.doesNotMatch(reconcile + chain + hardening, /flqercbgpgmmfaakrwkc|production/i, 'QA migration must not name production');
assert.doesNotMatch(chain + hardening, /efectos_pendientes/i, 'C07-D must use its dedicated fiscal queue');

assert.equal(cleanFixture.marker, 'C05_RECONCILIACION_LIMPIA');
assert.equal(cleanFixture.environment, 'QA');
assert.equal(cleanFixture.qa_only, true);
assert.equal(cleanFixture.queue_errors, 0);
assert.equal(cleanFixture.documents.length, 3);
assert.deepEqual(cleanFixture.documents.map((document) => document.number), [1, 2, 3]);
for (const document of cleanFixture.documents) {
  assert.equal(document.status, 'EMITIDO');
  assert.equal(document.currency_code, 'EUR');
  assert.equal(document.source.exists, true);
  assert.equal(document.source.line_count, 1);
  assert.equal(document.total, document.source.total);
  assert.equal(document.subtotal, document.source.subtotal);
  assert.equal(document.tax, document.source.tax);
  assert.equal(document.subtotal + document.tax, document.total);
}

console.log('ABC_F7_C07D_MIGRATION_CONTRACT=PASS');
console.log('ABC_F7_C07D_C05_CLEAN_FIXTURE_CONTRACT=PASS');
