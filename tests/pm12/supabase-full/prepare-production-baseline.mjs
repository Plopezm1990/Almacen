import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const target = join(here, 'supabase', 'migrations');

// El gate productivo NO puede heredar fixtures QA. Reconstruye el directorio
// temporal con solo: esquema productivo previo, baseline candidata y P08 real.
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

copyFileSync(
  join(repo, 'tests/pm12/prod-baseline/production-existing-schema-fixture.sql'),
  join(target, '20260907000000_production_existing_schema_fixture.sql')
);
copyFileSync(
  join(repo, 'tests/pm12/prod-baseline/pm12-produccion-baseline-candidate.sql'),
  join(target, '20260907010000_pm12_produccion_baseline_candidate.sql')
);
copyFileSync(
  join(repo, 'supabase/migrations/20260907155028_pm12_p08_stock_atomico.sql'),
  join(target, '20260907155028_pm12_p08_stock_atomico.sql')
);

const names = readdirSync(target).sort();
if (names.some(name => /qa|auth_rls_fixture|idempotency_dependencies_fixture/i.test(name))) {
  throw new Error('QA_FIXTURE_LEAK');
}
if (names.length !== 3) throw new Error(`UNEXPECTED_MIGRATION_COUNT:${names.length}`);
console.log('PM12_PROD_BASELINE_NO_QA_FIXTURES=PASS');
console.log('PM12_PROD_BASELINE_MIGRATIONS=' + names.join(','));
