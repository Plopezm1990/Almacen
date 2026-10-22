import assert from 'node:assert/strict';
import fs from 'node:fs';

const migrationPath = 'supabase/migrations/20261001090000_abc_f4_b10_card_data_boundary.sql';
const sql = fs.readFileSync(migrationPath, 'utf8');
const pciPath = 'supabase/migrations/20261001100000_abc_f4_b10_pci_capture_modes.sql';
const pciSql = fs.readFileSync(pciPath, 'utf8');
const gatePath = 'supabase/migrations/20261001110000_abc_f4_b10_pci_review_gate.sql';
const gateSql = fs.readFileSync(gatePath, 'utf8');
const onboardingPath = 'docs/plan-abc/F4_B10_ALTA_PROVEEDOR_PCI_2026-10-01.md';
const onboarding = fs.readFileSync(onboardingPath, 'utf8');

assert.match(sql, /create function private\.abc_b10_payload_sin_datos_tarjeta\(p_payload jsonb\)/i);
assert.match(sql, /language plpgsql[\s\S]*immutable[\s\S]*security definer[\s\S]*set search_path=''/i);
assert.match(sql, /jsonb_each\(p_payload\)/i);
assert.match(sql, /jsonb_array_elements\(p_payload\)/i);
for (const key of [
  'pan', 'primary_account_number', 'cvv', 'cvc', 'card_number',
  'cardnumber', 'numero_tarjeta', 'security_code', 'track_data',
  'payment_method_details', 'private_key', 'secret_value',
]) assert.match(sql, new RegExp(`'${key}'`, 'i'));

for (const constraint of [
  'abc_b10_pago_intento_snapshot_sin_tarjeta_ck',
  'abc_b10_reembolso_snapshot_sin_tarjeta_ck',
  'abc_b10_efecto_payload_sin_tarjeta_ck',
  'abc_b10_evento_payload_sin_tarjeta_ck',
  'abc_b10_b07_payload_sin_tarjeta_ck',
]) assert.match(sql, new RegExp(`add constraint ${constraint}`, 'i'));

assert.match(sql, /pago_intentos[\s\S]*provider_snapshot/i);
assert.match(sql, /reembolsos[\s\S]*provider_snapshot/i);
assert.match(sql, /efectos_pendientes[\s\S]*payload/i);
assert.match(sql, /abc_eventos[\s\S]*payload/i);
assert.match(sql, /abc_b07_eventos_proveedor[\s\S]*last_conflict_payload/i);
assert.match(sql, /ABC_F4_B10_DATOS_TARJETA_EXISTENTES/i);
assert.match(sql, /revoke all on function private\.abc_b10_payload_sin_datos_tarjeta\(jsonb\)[\s\S]*from public, anon, authenticated, service_role/i);
assert.doesNotMatch(sql, /insert into public\.(pagos|pago_intentos|reembolsos|abc_eventos|efectos_pendientes)/i);

assert.match(pciSql, /add column capture_mode text not null default 'EXTERNAL_TERMINAL'/i);
assert.match(pciSql, /abc_b10_capture_mode_ck/i);
for (const mode of ['EXTERNAL_TERMINAL', 'HOSTED_FIELDS', 'HOSTED_REDIRECT']) {
  assert.match(pciSql, new RegExp(`'${mode}'`, 'i'));
}
assert.match(pciSql, /'capture_mode',\s*p\.capture_mode/i);
assert.match(pciSql, /revoke all on function public\.abc_b07_obtener_configuracion/i);
assert.match(pciSql, /grant execute on function public\.abc_b07_obtener_configuracion[\s\S]*to service_role/i);

assert.match(gateSql, /add column pci_review_status text not null default 'PENDING_ACQUIRER'/i);
assert.match(gateSql, /abc_b10_pci_review_status_ck/i);
assert.match(gateSql, /abc_b10_pci_review_enable_ck/i);
assert.match(gateSql, /enabled = false or pci_review_status = 'APPROVED'/i);
assert.match(gateSql, /ABC_F4_B10_PCI_GATE_REQUIERE_REVISION/i);

for (const required of [
  'Adquirente / banco',
  'Proveedor de pagos',
  'EXTERNAL_TERMINAL',
  'HOSTED_FIELDS',
  'HOSTED_REDIRECT',
  'PENDING_ACQUIRER',
  'enabled = false',
  'PAN, CVV/CVC',
]) assert.match(onboarding, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));

console.log('ABC_F4_B10_CARD_DATA=PASS');
