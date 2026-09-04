import fs from 'node:fs';
import assert from 'node:assert/strict';

const f = JSON.parse(fs.readFileSync(new URL('./fixtures.json', import.meta.url), 'utf8'));

assert.equal(f.version, 'PM04-v1');
assert.equal(f.environment.productionDataCopied, false);
assert.notEqual(f.environment.supabaseProjectRef, f.environment.productionProjectRef);

const companyIds = new Set(f.companies.map(x => x.id));
for (const l of f.locations) assert.ok(companyIds.has(l.companyId), `local ${l.id} con empresa inválida`);
assert.equal(f.locations.filter(x => !x.active).length, 1);
assert.equal(f.locations.find(x => x.id === 'QA-A-CERRADO')?.active, false);

const emails = new Set(f.users.map(x => x.email));
assert.equal(emails.size, 5);
assert.equal(f.users.filter(x => !x.active).length, 1);
assert.deepEqual(f.users.find(x => x.email === 'operator.a1@qa.invalid')?.locationIds, ['QA-A1']);
assert.deepEqual(f.users.find(x => x.email === 'operator.a2@qa.invalid')?.locationIds, ['QA-A2']);
assert.deepEqual(f.users.find(x => x.email === 'owner.b@qa.invalid')?.locationIds, ['QA-B1']);

for (const s of f.stock) {
  assert.equal(s.total, s.warehouse + s.floor, `descuadre stock ${s.locationId}`);
  assert.ok(s.total >= 0, `stock negativo ${s.locationId}`);
}

const m = f.moneyExample;
const base = Math.round((m.total / (1 + m.vatPercent / 100)) * 100) / 100;
const vat = Math.round((m.total - base) * 100) / 100;
assert.equal(base, m.expectedBase);
assert.equal(vat, m.expectedVat);
assert.equal(m.quantity * f.products.find(x => x.id === 'QA-PROD-A-AGUA').cost, m.expectedCost);
assert.ok(24 > f.stock.find(x => x.locationId === 'QA-A1').total, 'caso venta 24/stock 23 mal definido');

console.log('PM04_FIXTURE_CONTRACTS_OK=1');
console.log('PM04_USERS=5');
console.log('PM04_LOCATIONS=A1,A2,A-CERRADO,B1');
console.log('PM04_PRODUCTION_DATA_COPIED=0');
