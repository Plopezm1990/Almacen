import assert from 'node:assert/strict';
import fs from 'node:fs';

const webhook = fs.readFileSync('supabase/functions/abc-b07-webhook/index.ts', 'utf8');
const adapter = fs.readFileSync('supabase/functions/_shared/abc-b07-adapter.mjs', 'utf8');
const resolver = fs.readFileSync('supabase/migrations/20260930153000_abc_f4_b07_server_config.sql', 'utf8');
const processing = fs.readFileSync('supabase/migrations/20260930160000_abc_f4_b07_event_processing.sql', 'utf8');

assert.match(webhook, /await req\.text\(\)/);
assert.match(webhook, /\.rpc\(\s*["']abc_b07_obtener_configuracion/);
assert.match(webhook, /ABC_B07_SIMULATION_SECRET/);
assert.match(webhook, /crypto\.subtle\.importKey/);
assert.match(webhook, /\.rpc\(\s*["']abc_b07_procesar_evento/);
assert.doesNotMatch(webhook, /abc_resolver_intento|insert into|update public\.pagos|empresa_id\s*=/i);
assert.doesNotMatch(webhook, /stripe|redsys|sumup/i);
assert.match(adapter, /assertNoCardData/);
assert.match(adapter, /provider_event_id/);
assert.match(resolver, /security definer/i);
assert.match(resolver, /set search_path=''/i);
assert.match(resolver, /revoke all on function public\.abc_b07_obtener_configuracion\(text,text\)/i);
assert.match(resolver, /grant execute on function public\.abc_b07_obtener_configuracion\(text,text\)[\s\S]*to service_role/i);
assert.doesNotMatch(resolver, /grant execute[\s\S]{0,180}(?:anon|authenticated)/i);
assert.match(processing, /create table public\.abc_b07_eventos_proveedor/);
assert.match(processing, /on conflict \(provider_code,provider_account_id,provider_event_id\) do nothing/i);
assert.match(processing, /create unique index abc_b07_event_key_uq/);
assert.match(processing, /public\.abc_resolver_intento\(/);
assert.match(processing, /PAYMENT_AMOUNT_OR_CURRENCY_MISMATCH/);
assert.match(processing, /PAYMENT_TRANSITION_REJECTED_/);
assert.doesNotMatch(processing, /grant execute[\s\S]{0,180}(?:anon|authenticated)/i);

const {
  normalizeProviderEvent,
  assertNoCardData,
} = await import('../../../supabase/functions/_shared/abc-b07-adapter.mjs');

const event = normalizeProviderEvent({
  providerCode: 'GENERIC_PAYMENTS',
  providerAccountId: 'merchant-001',
  payload: {
    id: 'evt-001',
    merchant: 'merchant-001',
    reference: 'order-001',
    amount: '12.50',
    currency: 'eur',
    status: 'paid',
  },
  normalizationConfig: {
    event_id: 'id',
    account_id: 'merchant',
    reference: 'reference',
    amount: 'amount',
    currency: 'currency',
    status: 'status',
    status_map: { paid: 'CONFIRMADO' },
  },
});
assert.equal(event.provider_account_id, 'merchant-001');
assert.equal(event.amount, 12.5);
assert.equal(event.currency, 'EUR');
assert.equal(event.event_type, 'PAYMENT_STATUS_CHANGED');
assert.equal(event.status, 'CONFIRMADO');
assert.throws(() => assertNoCardData({ payment_method_details: { last4: '1234' } }), /B07_PAYLOAD_SENSIBLE/);
assert.throws(() => normalizeProviderEvent({
  providerCode: 'GENERIC_PAYMENTS',
  providerAccountId: 'merchant-001',
  payload: { ...event.payload, merchant: 'merchant-002' },
  normalizationConfig: {
    event_id: 'id', account_id: 'merchant', reference: 'reference', amount: 'amount', currency: 'currency', status: 'status',
  },
}), /B07_CUENTA_NO_COINCIDE/);

console.log('ABC_F4_B07_WEBHOOK_CONTRACT=PASS');
