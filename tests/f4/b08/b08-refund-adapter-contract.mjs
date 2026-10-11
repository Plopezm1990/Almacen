import assert from 'node:assert/strict';

const { normalizeRefundProviderEvent } = await import(
  '../../../supabase/functions/_shared/abc-b07-adapter.mjs'
);

const profiles = [
  {
    providerCode: 'REFUND_ALPHA',
    accountId: 'alpha-refund-001',
    payload: {
      event: 'refund.updated',
      merchant: { id: 'alpha-refund-001' },
      refund: {
        id: 'rf_alpha_001',
        payment_reference: 'pay_alpha_001',
        amount: '12.50',
        currency: 'eur',
        status: 'succeeded',
      },
      occurred_at: '2026-09-30T16:00:00.000Z',
    },
    config: {
      event_id: 'refund.id',
      event_type: 'event',
      event_type_map: { 'refund.updated': 'REFUND_STATUS_CHANGED' },
      account_id: 'merchant.id',
      reference: 'refund.payment_reference',
      amount: 'refund.amount',
      currency: 'refund.currency',
      status: 'refund.status',
      status_map: { succeeded: 'CONFIRMADO' },
      occurred_at: 'occurred_at',
    },
    expected: {
      eventId: 'rf_alpha_001',
      reference: 'pay_alpha_001',
      amount: 12.5,
      status: 'CONFIRMADO',
      eventType: 'REFUND_STATUS_CHANGED',
    },
  },
  {
    providerCode: 'REFUND_BETA',
    accountId: 'beta-refund-007',
    payload: {
      id: 'rf_beta_007',
      account: 'beta-refund-007',
      payment_ref: 'pay_beta_007',
      amount: 31.25,
      currency: 'GBP',
      state: 'rejected',
      type: 'REFUND_REJECTED',
    },
    config: {
      event_id: 'id',
      event_type: 'type',
      account_id: 'account',
      reference: 'payment_ref',
      amount: 'amount',
      currency: 'currency',
      status: 'state',
      status_map: { rejected: 'RECHAZADO' },
    },
    expected: {
      eventId: 'rf_beta_007',
      reference: 'pay_beta_007',
      amount: 31.25,
      status: 'RECHAZADO',
      eventType: 'REFUND_REJECTED',
    },
  },
];

for (const profile of profiles) {
  const event = normalizeRefundProviderEvent({
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
  assert.equal(event.event_type, profile.expected.eventType);
}

assert.throws(() => normalizeRefundProviderEvent({
  providerCode: 'REFUND_ALPHA',
  providerAccountId: 'alpha-refund-001',
  payload: { event: 'payment.updated', id: 'evt-1', account: 'alpha-refund-001', reference: 'pay-1', amount: 1, currency: 'EUR', status: 'paid' },
  normalizationConfig: {
    event_id: 'id', event_type: 'event', account_id: 'account', reference: 'reference',
    amount: 'amount', currency: 'currency', status: 'status',
  },
}), /B08_EVENTO_NO_REEMBOLSO/);

assert.throws(() => normalizeRefundProviderEvent({
  providerCode: 'REFUND_ALPHA',
  providerAccountId: 'alpha-refund-001',
  payload: { event: 'refund.updated', id: 'evt-2', account: 'alpha-refund-001', reference: 'pay-2', amount: 1, currency: 'EUR', status: 'paid', card_number: '4111111111111111' },
  normalizationConfig: {
    event_id: 'id', event_type: 'event', account_id: 'account', reference: 'reference',
    amount: 'amount', currency: 'currency', status: 'status',
  },
}), /B07_PAYLOAD_SENSIBLE/);

console.log('ABC_F4_B08_REFUND_ADAPTER=PASS');
