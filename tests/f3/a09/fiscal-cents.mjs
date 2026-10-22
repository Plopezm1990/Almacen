// Reference projection for fiscal documents; internal A09 values stay at 8 decimals.
// Each aggregate is rounded once, then cents are allocated by largest remainder
// (stable line id). The explicit adjustment makes each displayed line reconcile.
const SCALE_8 = 100_000_000n;
const CENT = SCALE_8 / 100n;

function units8(value) {
  const match = String(value).match(/^(\d+)(?:\.(\d{1,8}))?$/);
  if (!match) throw new TypeError(`importe no positivo o con más de 8 decimales: ${value}`);
  return BigInt(match[1]) * SCALE_8 + BigInt((match[2] ?? '').padEnd(8, '0'));
}

function roundedCents(units) {
  return (units + CENT / 2n) / CENT;
}

function allocateCents(rows, values, target, ids, caps = null) {
  const parts = rows.map((row, index) => {
    const amount = values[index];
    return {id: String(row[ids]), cents: amount / CENT, remainder: amount % CENT};
  });
  let remaining = target - parts.reduce((sum, part) => sum + part.cents, 0n);
  if (caps && parts.some((part,index)=>part.cents>caps[index])) {
    throw new RangeError('base de presentación negativa');
  }
  const order = parts.map((part, index) => ({...part,index}))
    .filter((part)=>!caps || part.cents<caps[part.index])
    .sort((a,b) => a.remainder===b.remainder
      ? a.id < b.id ? -1 : a.id > b.id ? 1 : 0
      : a.remainder>b.remainder ? -1 : 1);
  if (remaining < 0n || remaining > BigInt(parts.length)) {
    throw new RangeError('residuo de céntimos fuera del rango de asignación');
  }
  if (remaining > BigInt(order.length)) {
    throw new RangeError('no hay subtotal mostrado suficiente para el descuento');
  }
  for (const entry of order) {
    if (remaining === 0n) break;
    parts[entry.index].cents += 1n;
    remaining -= 1n;
  }
  return parts.map((part) => part.cents);
}

function allocateGroupedCents(rows, values, buckets, ids) {
  const allocated=Array(rows.length).fill(0n);
  const groups=new Map();
  buckets.forEach((bucket,index)=>{
    const key=String(bucket);
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(index);
  });
  for (const indices of groups.values()) {
    const groupRows=indices.map((index)=>rows[index]);
    const groupValues=indices.map((index)=>values[index]);
    const target=roundedCents(groupValues.reduce((sum,value)=>sum+value,0n));
    const groupAllocation=allocateCents(groupRows,groupValues,target,ids);
    indices.forEach((index,position)=>{allocated[index]=groupAllocation[position];});
  }
  return allocated;
}

function money(cents) {
  const sign = cents < 0n ? '-' : '';
  const absolute = cents < 0n ? -cents : cents;
  return `${sign}${absolute/100n}.${String(absolute%100n).padStart(2,'0')}`;
}

export function projectFiscalCents(rows) {
  if (!Array.isArray(rows) || rows.length===0) throw new TypeError('documento sin líneas');
  const normalized = rows.map((row) => ({
    id: String(row.id),
    base: units8(row.base),
    gross: units8(row.base) + units8(row.discount),
    discount: units8(row.discount),
    tax: units8(row.tax),
    total: units8(row.total),
    taxBucket: String(row.taxBucket ?? 'default'),
  }));
  if (new Set(normalized.map((row) => row.id)).size!==normalized.length) {
    throw new TypeError('id de línea duplicado');
  }
  for (const row of normalized) {
    if (row.discount>row.gross || row.total!==row.base+row.tax) {
      throw new TypeError('línea interna no concilia');
    }
  }
  const allocate = (key) => {
    const amounts = normalized.map((row)=>row[key]);
    const target=roundedCents(amounts.reduce((sum,amount)=>sum+amount,0n));
    return allocateCents(normalized,amounts,target,'id');
  };
  const gross=allocate('gross');
  const discountAmounts=normalized.map((row)=>row.discount);
  const discountTarget=roundedCents(discountAmounts.reduce((sum,amount)=>sum+amount,0n));
  const discount=allocateCents(normalized,discountAmounts,discountTarget,'id',gross);
  const tax=allocateGroupedCents(normalized,normalized.map((row)=>row.tax),
    normalized.map((row)=>row.taxBucket),'id');
  const total=allocate('total');
  const lines=normalized.map((row,index)=>{
    const base=gross[index]-discount[index];
    const roundingAdjustment=total[index]-base-tax[index];
    return {id:row.id,subtotal:money(gross[index]),discount:money(discount[index]),
      base:money(base),tax:money(tax[index]),roundingAdjustment:money(roundingAdjustment),
      total:money(total[index])};
  });
  const sum=(key)=>lines.reduce((value,line)=>value+BigInt(line[key].replace('.','')),0n);
  const document={subtotal:money(sum('subtotal')),discount:money(sum('discount')),
    base:money(sum('base')),tax:money(sum('tax')),
    roundingAdjustment:money(sum('roundingAdjustment')),total:money(sum('total'))};
  if (BigInt(document.subtotal.replace('.',''))-
      BigInt(document.discount.replace('.',''))+BigInt(document.tax.replace('.',''))+
      BigInt(document.roundingAdjustment.replace('.',''))!==
      BigInt(document.total.replace('.',''))) {
    throw new Error('documento proyectado no concilia');
  }
  return {lines,document};
}
