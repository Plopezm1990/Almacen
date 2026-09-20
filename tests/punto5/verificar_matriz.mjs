#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const matrix = JSON.parse(readFileSync(join(here, 'MATRIZ_PROCEDENCIA_MIGRACIONES.json'), 'utf8'));

assert.equal(matrix.format, 'la-suite-migration-provenance-v1');
assert.equal(matrix.repository_migrations.length, matrix.counts.repository);
assert.equal(matrix.registered_histories.prod.length, matrix.counts.prod);
assert.equal(matrix.registered_histories.qa.length, matrix.counts.qa);

const count = (environment, classification) => matrix.repository_migrations
  .filter((migration) => migration[environment].classification === classification).length;

assert.equal(count('prod', 'exact_version_and_name'), matrix.counts.exact_repository_prod);
assert.equal(count('qa', 'exact_version_and_name'), matrix.counts.exact_repository_qa);
assert.equal(count('prod', 'same_name_different_version'), matrix.counts.same_name_different_version_prod);
assert.equal(count('qa', 'same_name_different_version'), matrix.counts.same_name_different_version_qa);
assert.equal(matrix.prod_remote_only.length, matrix.counts.prod_only_no_repo_match);
assert.equal(matrix.qa_remote_only.length, matrix.counts.qa_only_no_repo_match);

for (const migration of matrix.repository_migrations) {
  assert.match(migration.version, /^\d{14}$/);
  assert.match(migration.git_blob_sha1, /^[0-9a-f]{40}$/);
  for (const environment of ['prod', 'qa']) {
    assert.ok([
      'exact_version_and_name',
      'same_name_different_version',
      'not_registered_in_prod',
      'not_registered_in_qa'
    ].includes(migration[environment].classification));
  }
}

assert.ok(matrix.known_high_priority_lineage.some(
  (entry) => entry.repo === '20260919225831_pm33_p05_identidad_antes_de_actividad'
    && entry.classification === 'exact_version_and_name'
));
assert.ok(matrix.known_high_priority_lineage.some(
  (entry) => entry.prod === '20260916035012_p2_r02_revocar_exec_rpcs_legacy'
    && entry.classification === 'prod_only_no_repository_name_or_version_match'
));

console.log(
  'PUNTO5_MATRIZ=PASS',
  'REPO=' + matrix.counts.repository,
  'PROD=' + matrix.counts.prod,
  'QA=' + matrix.counts.qa,
  'EXACT_PROD=' + matrix.counts.exact_repository_prod,
  'EXACT_QA=' + matrix.counts.exact_repository_qa
);
