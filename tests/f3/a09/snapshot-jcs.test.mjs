import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SNAPSHOT_CANONICALIZATION, SNAPSHOT_HASH_ALGORITHM, SNAPSHOT_SCHEMA_VERSION,
  assertSnapshotAmount, canonicalSnapshotBytes, hashSnapshot,
} from './snapshot-jcs.mjs';

test('versioned fiscal snapshot has one JCS UTF-8 representation and SHA-256', () => {
  const snapshot = {
    schema_version: SNAPSHOT_SCHEMA_VERSION,
    canonicalization: SNAPSHOT_CANONICALIZATION,
    hash_algorithm: SNAPSHOT_HASH_ALGORITHM,
    currency: 'EUR',
    line: {
      id: '82000000-0000-0000-0000-000000000040',
      subtotal: '0.05500000', discount: '0.00000000',
      base: '0.05000000', tax: '0.00500000', total: '0.05500000',
      total_cents: '6', base_cents: '5', tax_cents: '1',
      rounding_adjustment_cents: '0', vat_rate: '10.0000',
    },
    text_vector: 'café 😀\n\u0001',
    flags: [true, null, false],
  };
  const expected = '{"canonicalization":"RFC8785-JCS","currency":"EUR","flags":[true,null,false],"hash_algorithm":"SHA-256","line":{"base":"0.05000000","base_cents":"5","discount":"0.00000000","id":"82000000-0000-0000-0000-000000000040","rounding_adjustment_cents":"0","subtotal":"0.05500000","tax":"0.00500000","tax_cents":"1","total":"0.05500000","total_cents":"6","vat_rate":"10.0000"},"schema_version":"la-fiscal-snapshot-v1","text_vector":"café 😀\\n\\u0001"}';
  const bytes = canonicalSnapshotBytes(snapshot);
  assert.equal(bytes.toString('utf8'), expected);
  assert.equal(hashSnapshot(snapshot), '90dcc4b3d6d7e46ec762973ecbee3c880d65bb7a6e22f940817f5c59bf6eca35');
});

test('money strings have canonical sign and scale; JSON numeric values are forbidden', () => {
  for (const value of ['0.00000000','12.34000000','-0.00000001','-12.34000000']) {
    assert.equal(assertSnapshotAmount(value,'DECIMAL_8'),value);
  }
  for (const value of ['+1.00000000','01.00000000','-0.00000000','1.0','1.000000000']) {
    assert.throws(() => assertSnapshotAmount(value,'DECIMAL_8'));
  }
  for (const value of ['0','1','-1','12345678901234567890']) {
    assert.equal(assertSnapshotAmount(value,'CENT_INTEGER'),value);
  }
  for (const value of ['+1','01','-0','1.0']) assert.throws(() => assertSnapshotAmount(value,'CENT_INTEGER'));
  assert.throws(() => canonicalSnapshotBytes({amount: 0.1}), /forbids JSON numbers/);
});

test('JCS escapes quotes, backslashes and controls while preserving slash and UTF-8 text', () => {
  const vector = {z: '"/\\\n\r\t\u0001', a: 'niño'};
  assert.equal(canonicalSnapshotBytes(vector).toString('utf8'),
    '{"a":"niño","z":"\\\"/\\\\\\n\\r\\t\\u0001"}');
});
