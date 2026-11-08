import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync('supabase/migrations/20261011170000_pm10_bootstrap_scope_fix.sql', 'utf8');

assert.match(migration, /e\.activo=true/);
assert.match(migration, /l\.activo=true/);
assert.match(migration, /not exists \(\s*select 1\s*from public\.entidades_fiscales/s);
assert.match(migration, /on conflict \(empresa_id,local_id,entidad_fiscal_id\)/);
assert.match(migration, /on conflict \(empresa_id,local_id,producto_id,currency_code\) do nothing/);
assert.match(migration, /from public\.entidad_fiscal_locales efl/);
assert.match(migration, /efl\.local_id=coalesce\(/);
assert.doesNotMatch(migration, /Chocolateria San Gines|Chocoloyos S\.L/);
assert.doesNotMatch(migration, /update public\.locales|activo\s*=\s*true\s*where/);

console.log('PM10 bootstrap scope fix: contrato OK');
