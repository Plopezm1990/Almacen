import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const reconcile = fs.readFileSync(path.join(root, 'supabase/migrations/20261027130000_abc_f7_c07d_c05_reconcile.sql'), 'utf8');
const chain = fs.readFileSync(path.join(root, 'supabase/migrations/20261027131500_abc_f7_c07d_fiscal_chain_queue.sql'), 'utf8');
const hardening = fs.readFileSync(path.join(root, 'supabase/migrations/20261027133000_abc_f7_c07d_chain_hardening.sql'), 'utf8');

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

console.log('ABC_F7_C07D_MIGRATION_CONTRACT=PASS');
