// A09 reference arithmetic. The database implementation must match these
// results before this module is used by any product flow.
const SCALE = 100000000n;

function decimal(value, label) {
  const text = String(value);
  if (!/^(0|[1-9]\d*)(?:\.\d{1,8})?$/.test(text)) {
    throw new Error(`${label}_invalid`);
  }
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(8, '0') || '0');
}

function signedDecimal(value, label) {
  const source = String(value);
  return source.startsWith('-') ? -decimal(source.slice(1), label) : decimal(source, label);
}

function format(value) {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  const whole = absolute / SCALE;
  const fraction = (absolute % SCALE).toString().padStart(8, '0').replace(/0+$/, '');
  return `${sign}${whole}${fraction ? `.${fraction}` : ''}`;
}

function roundedRatio(numerator, denominator) {
  if (denominator <= 0n) throw new Error('denominator_invalid');
  if (numerator < 0n) return -roundedRatio(-numerator, denominator);
  return (numerator + denominator / 2n) / denominator;
}

function splitByWeight(amount, weights) {
  const total = weights.reduce((sum, weight) => sum + weight, 0n);
  if (amount < 0n || amount > total || total <= 0n) throw new Error('allocation_invalid');
  const shares = weights.map((weight) => amount * weight / total);
  let remainder = amount - shares.reduce((sum, share) => sum + share, 0n);
  const order = weights.map((weight, index) => ({
    index,
    fraction: amount * weight % total,
  })).sort((a, b) => a.fraction === b.fraction
    ? a.index - b.index
    : a.fraction > b.fraction ? -1 : 1);
  for (const item of order) {
    if (remainder === 0n) break;
    if (shares[item.index] < weights[item.index]) {
      shares[item.index] += 1n;
      remainder -= 1n;
    }
  }
  if (remainder !== 0n) throw new Error('allocation_out_of_range');
  return shares;
}

function discountAmount(kind, value, available, allowZero = false) {
  if (available <= 0n) throw new Error('base_non_positive');
  if (kind === 'COURTESY') {
    if (value !== undefined && value !== null) throw new Error('courtesy_value_forbidden');
    return available;
  }
  const requested = decimal(value, 'discount_value');
  if (requested < 0n || (requested === 0n && !allowZero)) throw new Error('discount_zero');
  const amount = kind === 'PERCENT'
    ? roundedRatio(available * requested, 100n * SCALE)
    : kind === 'AMOUNT' ? requested : null;
  if (amount === null) throw new Error('discount_kind_invalid');
  if (kind === 'PERCENT' && requested > 100n * SCALE) throw new Error('discount_percent_exceeded');
  if (amount === 0n && !allowZero) throw new Error('discount_effective_zero');
  if (amount > available) throw new Error('discount_base_exceeded');
  if (amount === available && !allowZero) throw new Error('courtesy_required');
  return amount;
}

export function applyLineDiscount({ components, kind, value, minimumRemainingBase = '0', allowZero = false }) {
  if (!Array.isArray(components) || components.length === 0) throw new Error('components_required');
  const normalized = components.map((component) => ({
    base: signedDecimal(component.base, 'component_base'),
    taxPct: decimal(component.taxPct, 'component_tax_pct'),
    tax: component.tax === undefined ? undefined : signedDecimal(component.tax, 'component_tax'),
  }));
  if (normalized.some((component) => component.taxPct > 100n * SCALE)) {
    throw new Error('component_tax_pct_exceeded');
  }
  const grouped = new Map();
  for (const component of normalized) {
    const key = format(component.taxPct);
    const bucket = grouped.get(key) ?? { base: 0n, taxPct: component.taxPct, originalTax: 0n };
    bucket.base += component.base;
    bucket.originalTax += component.tax === undefined
      ? roundedRatio(component.base * component.taxPct, 100n * SCALE)
      : component.tax;
    grouped.set(key, bucket);
  }
  const buckets = [...grouped.values()].sort((a, b) => a.taxPct < b.taxPct ? -1 : a.taxPct > b.taxPct ? 1 : 0);
  if (buckets.some((bucket) => bucket.base < 0n || bucket.originalTax < 0n ||
    (bucket.base === 0n && bucket.originalTax !== 0n))) {
    throw new Error('signed_tax_bucket_invalid');
  }
  const grossBase = buckets.reduce((sum, bucket) => sum + bucket.base, 0n);
  const discount = discountAmount(kind, value, grossBase, allowZero);
  const remainingBase = grossBase - discount;
  if (kind !== 'COURTESY' && remainingBase < decimal(minimumRemainingBase, 'minimum_remaining_base')) {
    throw new Error('price_floor_violated');
  }
  const shares = splitByWeight(discount, buckets.map((bucket) => bucket.base));
  let totalTax = 0n;
  const resultComponents = buckets.map((bucket, index) => {
    const base = bucket.base - shares[index];
    const tax = base === 0n
      ? 0n
      : bucket.originalTax - roundedRatio(shares[index] * bucket.taxPct, 100n * SCALE);
    if (tax < 0n) throw new Error('signed_tax_bucket_invalid');
    totalTax += tax;
    return {
      grossBase: format(bucket.base),
      originalTax: format(bucket.originalTax),
      discount: format(shares[index]),
      base: format(base),
      taxPct: format(bucket.taxPct),
      tax: format(tax),
    };
  });
  return {
    grossBase: format(grossBase),
    discount: format(discount),
    base: format(remainingBase),
    tax: format(totalTax),
    total: format(remainingBase + totalTax),
    components: resultComponents,
  };
}

export function applyAccountDiscount({ lines, kind, value }) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error('lines_required');
  const ordered = [...lines].sort((a, b) => a.lineId < b.lineId ? -1 : a.lineId > b.lineId ? 1 : 0);
  if (new Set(ordered.map((line) => line.lineId)).size !== ordered.length) {
    throw new Error('line_id_duplicate');
  }
  const bases = ordered.map((line) => {
    if (!Array.isArray(line.components) || line.components.length === 0) throw new Error('components_required');
    return line.components.reduce((sum, component) => sum + signedDecimal(component.base, 'component_base'), 0n);
  });
  if (bases.some((base) => base <= 0n)) throw new Error('account_line_base_non_positive');
  const totalBase = bases.reduce((sum, base) => sum + base, 0n);
  const discount = discountAmount(kind, value, totalBase);
  const shares = splitByWeight(discount, bases);
  const results = ordered.map((line, index) => ({
    lineId: line.lineId,
    ...applyLineDiscount({
      components: line.components,
      kind: kind === 'COURTESY' ? 'COURTESY' : 'AMOUNT',
      value: kind === 'COURTESY' ? undefined : format(shares[index]),
      minimumRemainingBase: line.minimumRemainingBase ?? '0',
      allowZero: true,
    }),
  }));
  if (kind !== 'COURTESY' && results.some((line) =>
    decimal(line.discount, 'discount') > 0n && decimal(line.base, 'base') === 0n)) {
    throw new Error('courtesy_required');
  }
  return {
    grossBase: format(totalBase),
    discount: format(discount),
    base: format(results.reduce((sum, result) => sum + decimal(result.base, 'result_base'), 0n)),
    tax: format(results.reduce((sum, result) => sum + decimal(result.tax, 'result_tax'), 0n)),
    total: format(results.reduce((sum, result) => sum + decimal(result.total, 'result_total'), 0n)),
    lines: results,
  };
}

// Reference projection for A08 active rows. The caller must provide every active
// reparto of each touched source line and the fiscalized source-line set.
export function applyRepartoDiscount({
  repartos, accountId, kind, value, fiscalizedSourceLineIds = [],
  activeQuotaAccountIds = [], chargedAccountIds = [], maxPercent,
}) {
  if (!Array.isArray(repartos) || repartos.length === 0) throw new Error('repartos_required');
  if (new Set(repartos.map((r) => r.id)).size !== repartos.length) throw new Error('reparto_id_duplicate');
  const fiscalized = new Set(fiscalizedSourceLineIds);
  const quotaAccounts = new Set(activeQuotaAccountIds);
  const chargedAccounts = new Set(chargedAccountIds);
  const target = repartos.filter((r) => r.accountId === accountId);
  if (target.length === 0) throw new Error('account_without_repartos');
  const touchedSources = new Set(target.map((row) => row.sourceLineId));
  if (repartos.some((row) => touchedSources.has(row.sourceLineId) &&
    (quotaAccounts.has(row.accountId) || chargedAccounts.has(row.accountId)))) {
    throw new Error('source_line_financial_commitment');
  }
  for (const row of target) {
    if (row.mixedTax) throw new Error('split_mixed_tax_unsupported');
    if (fiscalized.has(row.sourceLineId)) throw new Error('source_line_partially_fiscalized');
    if (decimal(row.base, 'reparto_base') + decimal(row.tax, 'reparto_tax') !==
      decimal(row.total, 'reparto_total')) throw new Error('reparto_total_inconsistent');
    decimal(row.discount, 'reparto_discount');
  }
  const result = applyAccountDiscount({
    lines: target.map((row) => ({
      lineId: row.id,
      components: [{ base: row.base, taxPct: row.taxPct, tax: row.tax }],
    })), kind, value,
  });
  const resultById = new Map(result.lines.map((line) => [line.lineId, line]));
  const changedSources = new Set(target.filter((row) =>
    decimal(resultById.get(row.id).discount, 'discount') > 0n).map((row) => row.sourceLineId));
  const updated = repartos.map((row) => {
    const line = resultById.get(row.id);
    return line ? {
      ...row,
      discount: format(decimal(row.discount, 'reparto_discount') + decimal(line.discount, 'discount')),
      base: line.base, tax: line.tax, total: line.total,
    } : { ...row };
  });
  const cap = decimal(maxPercent, 'max_percent');
  if (cap > 100n * SCALE) throw new Error('max_percent_invalid');
  const bySource = new Map();
  for (const row of updated.filter((r) => touchedSources.has(r.sourceLineId))) {
    const current = bySource.get(row.sourceLineId) ?? { gross: 0n, discount: 0n, base: 0n, tax: 0n, total: 0n };
    current.base += decimal(row.base, 'reparto_base');
    current.discount += decimal(row.discount, 'reparto_discount');
    current.tax += decimal(row.tax, 'reparto_tax');
    current.total += decimal(row.total, 'reparto_total');
    current.gross = current.base + current.discount;
    bySource.set(row.sourceLineId, current);
  }
  for (const [sourceId, amounts] of bySource) {
    if (!changedSources.has(sourceId)) continue;
    if (amounts.discount * 100n * SCALE > amounts.gross * cap) {
      throw new Error('cumulative_discount_limit_exceeded');
    }
  }
  return {
    ...result,
    repartos: updated,
    sourceLineTotals: Object.fromEntries([...bySource].map(([id, amounts]) => [id, {
      grossBase: format(amounts.gross), discount: format(amounts.discount),
      base: format(amounts.base), tax: format(amounts.tax), total: format(amounts.total),
    }])),
  };
}
