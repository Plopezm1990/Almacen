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

function format(value) {
  const whole = value / SCALE;
  const fraction = (value % SCALE).toString().padStart(8, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

function roundedRatio(numerator, denominator) {
  if (denominator <= 0n) throw new Error('denominator_invalid');
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
  return amount;
}

export function applyLineDiscount({ components, kind, value, minimumRemainingBase = '0', allowZero = false }) {
  if (!Array.isArray(components) || components.length === 0) throw new Error('components_required');
  const normalized = components.map((component) => ({
    base: decimal(component.base, 'component_base'),
    taxPct: decimal(component.taxPct, 'component_tax_pct'),
  }));
  if (normalized.some((component) => component.taxPct > 100n * SCALE)) {
    throw new Error('component_tax_pct_exceeded');
  }
  const grossBase = normalized.reduce((sum, component) => sum + component.base, 0n);
  const discount = discountAmount(kind, value, grossBase, allowZero);
  const remainingBase = grossBase - discount;
  if (kind !== 'COURTESY' && remainingBase < decimal(minimumRemainingBase, 'minimum_remaining_base')) {
    throw new Error('price_floor_violated');
  }
  const shares = splitByWeight(discount, normalized.map((component) => component.base));
  let totalTax = 0n;
  const resultComponents = normalized.map((component, index) => {
    const base = component.base - shares[index];
    const tax = roundedRatio(base * component.taxPct, 100n * SCALE);
    totalTax += tax;
    return {
      grossBase: format(component.base),
      discount: format(shares[index]),
      base: format(base),
      taxPct: format(component.taxPct),
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
    return line.components.reduce((sum, component) => sum + decimal(component.base, 'component_base'), 0n);
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
  return {
    grossBase: format(totalBase),
    discount: format(discount),
    base: format(results.reduce((sum, result) => sum + decimal(result.base, 'result_base'), 0n)),
    tax: format(results.reduce((sum, result) => sum + decimal(result.tax, 'result_tax'), 0n)),
    total: format(results.reduce((sum, result) => sum + decimal(result.total, 'result_total'), 0n)),
    lines: results,
  };
}
