import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAccountDiscount, applyLineDiscount } from './discount-math.mjs';

test('A03: el porcentaje reduce base e IVA y conserva la suma', () => {
  const result = applyLineDiscount({
    components: [{ base: '10', taxPct: '10' }],
    kind: 'PERCENT', value: '20',
  });
  assert.deepEqual(
    [result.grossBase, result.discount, result.base, result.tax, result.total],
    ['10', '2', '8', '0.8', '8.8'],
  );
});

test('A04: importe fijo se reparte por base entre tipos de IVA distintos', () => {
  const result = applyLineDiscount({
    components: [{ base: '10', taxPct: '10' }, { base: '5', taxPct: '21' }],
    kind: 'AMOUNT', value: '3',
  });
  assert.deepEqual(result.components.map((part) => part.discount), ['2', '1']);
  assert.deepEqual(result.components.map((part) => part.tax), ['0.8', '0.84']);
  assert.deepEqual([result.discount, result.base, result.tax, result.total], ['3', '12', '1.64', '13.64']);
});

test('cortesía anula la base y el IVA, incluso con varios componentes', () => {
  const result = applyLineDiscount({
    components: [{ base: '8', taxPct: '10' }, { base: '2', taxPct: '21' }],
    kind: 'COURTESY', minimumRemainingBase: '1',
  });
  assert.deepEqual([result.discount, result.base, result.tax, result.total], ['10', '0', '0', '0']);
});

test('reparto determinista por residuo mayor en ocho decimales', () => {
  const result = applyAccountDiscount({
    lines: [
      { lineId: 'c', components: [{ base: '1', taxPct: '0' }] },
      { lineId: 'a', components: [{ base: '1', taxPct: '0' }] },
      { lineId: 'b', components: [{ base: '1', taxPct: '0' }] },
    ],
    kind: 'AMOUNT', value: '0.00000001',
  });
  assert.deepEqual(result.lines.map(({ lineId, discount }) => [lineId, discount]), [
    ['a', '0.00000001'], ['b', '0'], ['c', '0'],
  ]);
  assert.equal(result.total, '2.99999999');
});

test('porcentaje a nivel cuenta reparte entre líneas y conserva totales', () => {
  const result = applyAccountDiscount({
    lines: [
      { lineId: 'b', components: [{ base: '20', taxPct: '21' }] },
      { lineId: 'a', components: [{ base: '10', taxPct: '10' }] },
    ], kind: 'PERCENT', value: '10',
  });
  assert.deepEqual(result.lines.map(({ lineId, discount }) => [lineId, discount]), [
    ['a', '1'], ['b', '2'],
  ]);
  assert.deepEqual([result.discount, result.base, result.tax, result.total], ['3', '27', '4.68', '31.68']);
});

test('los límites de autorización y precio se rechazan antes de persistir', () => {
  const line = { components: [{ base: '10', taxPct: '10' }] };
  assert.throws(() => applyLineDiscount({ ...line, kind: 'PERCENT', value: '100.00000001' }), /discount_percent_exceeded/);
  assert.throws(() => applyLineDiscount({ ...line, kind: 'AMOUNT', value: '11' }), /discount_base_exceeded/);
  assert.throws(() => applyLineDiscount({ ...line, kind: 'AMOUNT', value: '9', minimumRemainingBase: '2' }), /price_floor_violated/);
  assert.throws(() => applyLineDiscount({ ...line, kind: 'AMOUNT', value: '0' }), /discount_zero/);
  assert.throws(() => applyLineDiscount({ ...line, kind: 'PERCENT', value: '0.00000001' }), /discount_effective_zero/);
  assert.throws(() => applyLineDiscount({ ...line, kind: 'COURTESY', value: '1' }), /courtesy_value_forbidden/);
  assert.throws(() => applyLineDiscount({ ...line, kind: 'AMOUNT', value: '0.000000001' }), /discount_value_invalid/);
  assert.throws(() => applyLineDiscount({ components: [{ base: '-1', taxPct: '10' }], kind: 'AMOUNT', value: '1' }), /component_base_invalid/);
});

test('una cuenta ambigua o con base nula se rechaza', () => {
  const valid = { lineId: 'x', components: [{ base: '1', taxPct: '0' }] };
  assert.throws(() => applyAccountDiscount({ lines: [valid, valid], kind: 'AMOUNT', value: '1' }), /line_id_duplicate/);
  assert.throws(() => applyAccountDiscount({ lines: [{ lineId: 'x', components: [{ base: '0', taxPct: '0' }] }], kind: 'AMOUNT', value: '1' }), /account_line_base_non_positive/);
});
