import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAccountDiscount, applyLineDiscount, applyRepartoDiscount } from './discount-math.mjs';

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

test('A04: retirada negativa reduce la base original y el límite porcentual', () => {
  const result = applyLineDiscount({
    components: [
      { base: '10', taxPct: '10' },
      { base: '-2', taxPct: '10' },
      { base: '3', taxPct: '21' },
    ], kind: 'PERCENT', value: '20',
  });
  assert.deepEqual([result.grossBase, result.discount, result.base, result.tax, result.total],
    ['11', '2.2', '8.8', '1.144', '9.944']);
  assert.deepEqual(result.components.map(({ grossBase, discount }) => [grossBase, discount]),
    [['8', '1.6'], ['3', '0.6']]);
});

test('A04: no se reparte descuento sobre un grupo fiscal neto negativo', () => {
  assert.throws(() => applyLineDiscount({
    components: [{ base: '10', taxPct: '10' }, { base: '-2', taxPct: '21' }],
    kind: 'PERCENT', value: '10',
  }), /signed_tax_bucket_invalid/);
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

test('un descuento de cuenta no puede convertir una línea pequeña en cortesía', () => {
  assert.throws(() => applyAccountDiscount({
    lines: [
      { lineId: 'large', components: [{ base: '1', taxPct: '0' }] },
      { lineId: 'tiny', components: [{ base: '0.00000001', taxPct: '0' }] },
    ], kind: 'AMOUNT', value: '1',
  }), /courtesy_required/);
});

test('los límites de autorización y precio se rechazan antes de persistir', () => {
  const line = { components: [{ base: '10', taxPct: '10' }] };
  assert.throws(() => applyLineDiscount({ ...line, kind: 'PERCENT', value: '100.00000001' }), /discount_percent_exceeded/);
  assert.throws(() => applyLineDiscount({ ...line, kind: 'AMOUNT', value: '11' }), /discount_base_exceeded/);
  assert.throws(() => applyLineDiscount({ ...line, kind: 'AMOUNT', value: '10' }), /courtesy_required/);
  assert.throws(() => applyLineDiscount({ ...line, kind: 'PERCENT', value: '100' }), /courtesy_required/);
  assert.throws(() => applyLineDiscount({ ...line, kind: 'AMOUNT', value: '9', minimumRemainingBase: '2' }), /price_floor_violated/);
  assert.throws(() => applyLineDiscount({ ...line, kind: 'AMOUNT', value: '0' }), /discount_zero/);
  assert.throws(() => applyLineDiscount({ ...line, kind: 'PERCENT', value: '0.00000001' }), /discount_effective_zero/);
  assert.throws(() => applyLineDiscount({ ...line, kind: 'COURTESY', value: '1' }), /courtesy_value_forbidden/);
  assert.throws(() => applyLineDiscount({ ...line, kind: 'AMOUNT', value: '0.000000001' }), /discount_value_invalid/);
  assert.throws(() => applyLineDiscount({ components: [{ base: '-1', taxPct: '10' }], kind: 'AMOUNT', value: '1' }), /signed_tax_bucket_invalid/);
});

test('una cuenta ambigua o con base nula se rechaza', () => {
  const valid = { lineId: 'x', components: [{ base: '1', taxPct: '0' }] };
  assert.throws(() => applyAccountDiscount({ lines: [valid, valid], kind: 'AMOUNT', value: '1' }), /line_id_duplicate/);
  assert.throws(() => applyAccountDiscount({ lines: [{ lineId: 'x', components: [{ base: '0', taxPct: '0' }] }], kind: 'AMOUNT', value: '1' }), /account_line_base_non_positive/);
});

const splitRows = () => [
  { id: 'r-a', accountId: 'a', sourceLineId: 'line-1', base: '6', discount: '0', tax: '0.6', total: '6.6', taxPct: '10' },
  { id: 'r-b', accountId: 'b', sourceLineId: 'line-1', base: '4', discount: '0', tax: '0.4', total: '4.4', taxPct: '10' },
];

test('A08: descuento en cuenta repartida conserva la otra cuota y la línea fuente', () => {
  const result = applyRepartoDiscount({
    repartos: splitRows(), accountId: 'b', kind: 'PERCENT', value: '20', maxPercent: '20',
  });
  assert.deepEqual(result.repartos.map(({ id, discount, base, tax, total }) =>
    [id, discount, base, tax, total]), [
    ['r-a', '0', '6', '0.6', '6.6'],
    ['r-b', '0.8', '3.2', '0.32', '3.52'],
  ]);
  assert.deepEqual(result.sourceLineTotals['line-1'], {
    grossBase: '10', discount: '0.8', base: '9.2', tax: '0.92', total: '10.12',
  });
});

test('A08: fiscalización parcial en cualquier cuota inmoviliza la línea completa', () => {
  assert.throws(() => applyRepartoDiscount({
    repartos: splitRows(), accountId: 'b', kind: 'AMOUNT', value: '1', maxPercent: '100',
    fiscalizedSourceLineIds: ['line-1'],
  }), /source_line_partially_fiscalized/);
});

test('A08: una cuota activa o un cobro en otra cuenta de la misma línea bloquea la rebaja', () => {
  for (const field of ['activeQuotaAccountIds', 'chargedAccountIds']) {
    assert.throws(() => applyRepartoDiscount({
      repartos: splitRows(), accountId: 'b', kind: 'AMOUNT', value: '1',
      maxPercent: '100', [field]: ['a'],
    }), /source_line_financial_commitment/);
  }
});

test('A08: reparto mixto sin desglose fiscal propio queda bloqueado', () => {
  const rows = splitRows();
  rows[1].mixedTax = true;
  assert.throws(() => applyRepartoDiscount({
    repartos: rows, accountId: 'b', kind: 'AMOUNT', value: '1', maxPercent: '100',
  }), /split_mixed_tax_unsupported/);
});

test('A08: conserva el IVA redondeado del reparto al aplicar una rebaja', () => {
  const result = applyRepartoDiscount({
    repartos: [{
      id: 'r-a', accountId: 'a', sourceLineId: 'line-1', base: '1', discount: '0',
      tax: '0.09999999', total: '1.09999999', taxPct: '10',
    }], accountId: 'a', kind: 'AMOUNT', value: '0.1', maxPercent: '100',
  });
  assert.deepEqual([result.repartos[0].base, result.repartos[0].tax, result.repartos[0].total],
    ['0.9', '0.08999999', '0.98999999']);
});

test('A08: el límite acumulado mira toda la línea fuente, también tras varios repartos', () => {
  const first = applyRepartoDiscount({
    repartos: splitRows(), accountId: 'a', kind: 'AMOUNT', value: '2', maxPercent: '20',
  });
  assert.throws(() => applyRepartoDiscount({
    repartos: first.repartos, accountId: 'b', kind: 'AMOUNT', value: '0.00000001', maxPercent: '20',
  }), /cumulative_discount_limit_exceeded/);
});

test('A08: cortesía de una cuota solo anula su saldo; conserva las demás', () => {
  const result = applyRepartoDiscount({
    repartos: splitRows(), accountId: 'b', kind: 'COURTESY', maxPercent: '100',
  });
  assert.deepEqual(result.repartos.map(({ total }) => total), ['6.6', '0']);
  assert.deepEqual(result.sourceLineTotals['line-1'], {
    grossBase: '10', discount: '4', base: '6', tax: '0.6', total: '6.6',
  });
});
