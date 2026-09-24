import assert from 'node:assert/strict';
import test from 'node:test';
import { DiscountCommandReference } from './discount-command.mjs';

const state = (overrides = {}) => ({
  accountVersion: 1,
  members: { owner: 'Propietario', manager: 'Encargado', cashier: 'Cajero/a' },
  repartos: [{
    id: 'r-a', accountId: 'account-a', sourceLineId: 'line-1',
    base: '10', discount: '0', tax: '1', total: '11', taxPct: '10',
  }],
  fiscalizedSourceLineIds: [],
  ...overrides,
});

const request = (overrides = {}) => ({
  operationId: 'a09-test-0001', accountId: 'account-a', expectedVersion: 1,
  kind: 'AMOUNT', value: '2', reason: 'Atención al cliente', ...overrides,
});

test('límite de Encargado: 20 % acumulado, incluso en una segunda operación', async () => {
  const engine = new DiscountCommandReference(state());
  await engine.execute(request(), 'manager');
  await assert.rejects(engine.execute(request({
    operationId: 'a09-test-0002', expectedVersion: 2, value: '0.00000001',
  }), 'manager'), /cumulative_discount_limit_exceeded/);
  assert.equal(engine.state.accountVersion, 2);
  assert.equal(engine.audit.length, 1);
});

test('Propietario puede dar cortesía; Encargado, Caja y ajenos no', async () => {
  const owner = new DiscountCommandReference(state());
  const result = await owner.execute(request({ kind: 'COURTESY', value: undefined }), 'owner');
  assert.equal(result.total, '0');
  assert.equal(owner.audit[0].authorizerId, 'owner');
  for (const actor of ['manager', 'cashier', 'outside']) {
    const engine = new DiscountCommandReference(state());
    await assert.rejects(engine.execute(request({ kind: 'COURTESY', value: undefined }), actor),
      /courtesy_capability_denied|discount_capability_denied|local_membership_required/);
  }
});

test('política específica de usuario puede ampliar capacidad, pero deja rastro', async () => {
  const engine = new DiscountCommandReference(state({ userLimits: { cashier: '10' } }));
  const result = await engine.execute(request({ value: '1' }), 'cashier');
  assert.equal(result.discount, '1');
  assert.equal(engine.audit[0].requesterId, 'cashier');
  assert.equal(engine.audit[0].reason, 'Atención al cliente');
});

test('100 % por importe o porcentaje no elude la capacidad de cortesía', async () => {
  const engine = new DiscountCommandReference(state({ userLimits: { cashier: '100' } }));
  await assert.rejects(engine.execute(request({ value: '10' }), 'cashier'), /courtesy_required/);
  await assert.rejects(engine.execute(request({ kind: 'PERCENT', value: '100' }), 'cashier'), /courtesy_required/);
  assert.equal(engine.audit.length, 0);
});

test('motivo y doble autorización pendiente fallan sin efectos', async () => {
  const engine = new DiscountCommandReference(state());
  await assert.rejects(engine.execute(request({ reason: '  ' }), 'owner'), /reason_required/);
  assert.equal(engine.audit.length, 0);
  const guarded = new DiscountCommandReference(state({ requireDualApproval: true }));
  await assert.rejects(guarded.execute(request(), 'owner'), /dual_approval_required/);
  assert.equal(guarded.state.accountVersion, 1);
});

test('reintento idéntico devuelve el resultado original sin segundo asiento', async () => {
  const engine = new DiscountCommandReference(state());
  const first = await engine.execute(request(), 'manager');
  const second = await engine.execute(request(), 'manager');
  assert.equal(first.replayed, false);
  assert.deepEqual(second, { ...first, replayed: true });
  assert.equal(engine.state.accountVersion, 2);
  assert.equal(engine.audit.length, 1);
  await assert.rejects(engine.execute(request({ value: '1' }), 'manager'), /operation_id_conflict/);
  delete engine.state.members.manager;
  await assert.rejects(engine.execute(request(), 'manager'), /local_membership_required/);
});

test('dos descuentos concurrentes con la misma versión: uno se aplica y otro falla', async () => {
  const engine = new DiscountCommandReference(state());
  const outcomes = await Promise.allSettled([
    engine.execute(request({ operationId: 'a09-test-0001', value: '1' }), 'owner'),
    engine.execute(request({ operationId: 'a09-test-0002', value: '1' }), 'owner'),
  ]);
  assert.deepEqual(outcomes.map((outcome) => outcome.status), ['fulfilled', 'rejected']);
  assert.match(outcomes[1].reason.message, /account_version_conflict/);
  assert.equal(engine.state.repartos[0].discount, '1');
  assert.equal(engine.audit.length, 1);
});

test('dos reintentos concurrentes del mismo operation_id producen un único efecto', async () => {
  const engine = new DiscountCommandReference(state());
  const outcomes = await Promise.all([
    engine.execute(request(), 'manager'),
    engine.execute(request(), 'manager'),
  ]);
  assert.deepEqual(outcomes.map((outcome) => outcome.replayed), [false, true]);
  assert.equal(engine.audit.length, 1);
});
