import assert from 'node:assert/strict';

const {
  normalizeProviderEvent,
  signatureValue,
} = await import('../../../supabase/functions/_shared/abc-b07-adapter.mjs');

const profiles = [
  {
    providerCode: 'PROVIDER_ALPHA',
    accountId: 'alpha-merchant-001',
    payload: {
      data: {
        event: 'alpha-event-001',
        merchant: { id: 'alpha-merchant-001' },
        order: { reference: 'alpha-order-001' },
        value: { amount: '18.40', currency: 'eur' },
        state: 'settled',
        happened_at: '2026-09-30T13:00:00.000Z',
      },
    },
    config: {
      event_id: 'data.event',
      account_id: 'data.merchant.id',
      reference: 'data.order.reference',
      amount: 'data.value.amount',
      currency: 'data.value.currency',
      status: 'data.state',
      occurred_at: 'data.happened_at',
      status_map: { settled: 'CONFIRMADO' },
    },
    expected: {
      eventId: 'alpha-event-001',
      reference: 'alpha-order-001',
      amount: 18.4,
      status: 'CONFIRMADO',
    },
  },
  {
    providerCode: 'PROVIDER_BETA',
    accountId: 'beta-account-007',
    payload: {
      event_id: 'beta-event-007',
      account_id: 'beta-account-007',
      payment: { reference: 'beta-order-007', amount: 31.25, currency: 'GBP' },
      result: 'paid',
      occurred: '2026-09-30T14:00:00.000Z',
    },
    config: {
      event_id: 'event_id',
      account_id: 'account_id',
      reference: 'payment.reference',
      amount: 'payment.amount',
      currency: 'payment.currency',
      status: 'result',
      occurred_at: 'occurred',
      status_map: { paid: 'CONFIRMADO' },
    },
    expected: {
      eventId: 'beta-event-007',
      reference: 'beta-order-007',
      amount: 31.25,
      status: 'CONFIRMADO',
    },
  },
];

for (const profile of profiles) {
  const event = normalizeProviderEvent({
    providerCode: profile.providerCode,
    providerAccountId: profile.accountId,
    payload: profile.payload,
    normalizationConfig: profile.config,
  });
  assert.equal(event.provider_code, profile.providerCode);
  assert.equal(event.provider_account_id, profile.accountId);
  assert.equal(event.provider_event_id, profile.expected.eventId);
  assert.equal(event.provider_reference, profile.expected.reference);
  assert.equal(event.amount, profile.expected.amount);
  assert.equal(event.status, profile.expected.status);
  assert.match(event.occurred_at, /^2026-09-30T/);
}

assert.equal(signatureValue('sha256=alpha-signature', { prefix: 'sha256=' }), 'alpha-signature');
assert.equal(signatureValue('v1=beta-signature', { prefix: 'v1=' }), 'beta-signature');
assert.equal(signatureValue('wrong=signature', { prefix: 'v1=' }), null);

console.log('ABC_F4_B07_GENERIC_PROVIDERS=PASS');
