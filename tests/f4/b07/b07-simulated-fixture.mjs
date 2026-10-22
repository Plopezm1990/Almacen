import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import {
  assertNoCardData,
  constantTimeEqualText,
  encodeSignature,
  normalizeProviderEvent,
} from '../../../supabase/functions/_shared/abc-b07-adapter.mjs';

const raw = fs.readFileSync('tests/f4/b07/fixtures/generic-provider-event.json', 'utf8');
const payload = JSON.parse(raw);
const secret = 'b07-fixture-only-secret';
const signature = createHmac('sha256', secret).update(raw).digest();
const normalizationConfig = {
  event_id: 'event_id',
  account_id: 'merchant',
  reference: 'reference',
  amount: 'amount',
  currency: 'currency',
  status: 'status',
  status_map: { paid: 'CONFIRMADO' },
  occurred_at: 'occurred_at',
};

assertNoCardData(payload);
const event = normalizeProviderEvent({
  providerCode: 'GENERIC_PAYMENTS',
  providerAccountId: 'merchant-qa-001',
  payload,
  normalizationConfig,
});
const encoded = encodeSignature(new Uint8Array(signature), 'HEX');

assert.equal(event.provider_event_id, 'evt_b07_fixture_001');
assert.equal(event.provider_reference, 'checkout-qa-001');
assert.equal(event.status, 'CONFIRMADO');
assert.equal(event.amount, 22);
assert.equal(event.currency, 'EUR');
assert.equal(event.occurred_at, '2026-09-30T12:00:00.000Z');
assert.equal(constantTimeEqualText(encoded, encoded), true);
assert.equal(encoded.length, 64);

console.log(JSON.stringify({
  contract: 'ABC_F4_B07_SIMULATED_FIXTURE',
  signature_encoding: 'HEX',
  provider_event_id: event.provider_event_id,
  status: event.status,
  amount: event.amount,
  currency: event.currency,
}));
