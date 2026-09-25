#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const INVENTORY = 153;
const CLASSES = ['active_contract', 'historical_expected_fail', 'utility', 'diagnostic'];
const ENVIRONMENTS = ['node', 'postgres', 'pglite', 'supabase_full_stack'];
const PAIRS = {
  node: ['active_contract', 'utility', 'diagnostic'],
  postgres: ['active_contract', 'historical_expected_fail'],
  pglite: ['active_contract', 'utility'],
  supabase_full_stack: ['active_contract'],
};
const COUNTS = { active_contract: 139, historical_expected_fail: 1, utility: 8, diagnostic: 5 };
const ENVIRONMENT_COUNTS = {
  node: { active_contract: 125, historical_expected_fail: 0, utility: 7, diagnostic: 5 },
  postgres: { active_contract: 10, historical_expected_fail: 1, utility: 0, diagnostic: 0 },
  pglite: { active_contract: 1, historical_expected_fail: 0, utility: 1, diagnostic: 0 },
  supabase_full_stack: { active_contract: 3, historical_expected_fail: 0, utility: 0, diagnostic: 0 },
};
const A09 = {
  'tests/f3/a09/discount-command.mjs': ['utility', 'node'],
  'tests/f3/a09/discount-command.test.mjs': ['active_contract', 'node'],
  'tests/f3/a09/discount-math.mjs': ['utility', 'node'],
  'tests/f3/a09/discount-math.test.mjs': ['active_contract', 'node'],
  'tests/f3/a09/fiscal-cents.mjs': ['utility', 'node'],
  'tests/f3/a09/fiscal-cents.test.mjs': ['active_contract', 'node'],
  'tests/f3/a09/local-pglite-bootstrap.mjs': ['utility', 'pglite'],
  'tests/f3/a09/local-pglite-contract.mjs': ['active_contract', 'pglite'],
  'tests/f3/a09/local-postgres-contract.mjs': ['active_contract', 'postgres'],
  'tests/f3/a09/snapshot-jcs.mjs': ['utility', 'node'],
  'tests/f3/a09/snapshot-jcs.test.mjs': ['active_contract', 'node'],
};

function zeroCounts(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function validate(manifest, realPaths) {
  const issues = [];
  const add = (code, message) => issues.push({ code, message });
  const entriesValid = Array.isArray(manifest?.entries);
  const entries = entriesValid ? manifest.entries : [];
  const occurrences = new Map();
  const counts = zeroCounts(CLASSES);
  const byEnvironment = Object.fromEntries(
    ENVIRONMENTS.map((environment) => [environment, zeroCounts(CLASSES)]),
  );
  const realSet = new Set(realPaths);

  if (!entriesValid) add('invalid_entries', 'entries debe ser un array.');
  if (realPaths.length !== INVENTORY) add('inventory_count', 'inventario=' + realPaths.length + '; esperado=' + INVENTORY + '.');
  if (manifest?.total_inventory !== realPaths.length) {
    add('declared_inventory_count', 'total_inventory=' + manifest?.total_inventory + '; inventario=' + realPaths.length + '.');
  }
  if (entries.length !== realPaths.length) add('entry_count', 'entries=' + entries.length + '; inventario=' + realPaths.length + '.');

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      add('invalid_entry', 'entries[' + i + '] debe ser un objeto.');
    } else {
      if (typeof entry.path !== 'string' || entry.path.length === 0) {
        add('invalid_path', 'entries[' + i + '].path debe ser una ruta no vacía.');
      } else {
        occurrences.set(entry.path, (occurrences.get(entry.path) ?? 0) + 1);
      }

      const validClass = CLASSES.includes(entry.classification);
      const validEnvironment = ENVIRONMENTS.includes(entry.environment);
      if (!validClass) {
        add('invalid_classification', 'entries[' + i + '] (' + (entry.path ?? '?') + ') classification=' + String(entry.classification) + '.');
      } else {
        counts[entry.classification] += 1;
      }
      if (!validEnvironment) {
        add('invalid_environment', 'entries[' + i + '] (' + (entry.path ?? '?') + ') environment=' + String(entry.environment) + '.');
      }
      if (validClass && validEnvironment) {
        byEnvironment[entry.environment][entry.classification] += 1;
        if (!PAIRS[entry.environment].includes(entry.classification)) {
          add('invalid_classification_environment', 'entries[' + i + '] combina ' + entry.classification + '/' + entry.environment + '.');
        }
      }
    }
  }

  for (const [path, count] of occurrences) {
    if (count > 1) add('duplicate_path', path + ' aparece ' + count + ' veces.');
  }
  const manifestPaths = new Set(occurrences.keys());
  for (const path of realPaths) {
    if (!manifestPaths.has(path)) add('missing_path', path + ' no aparece en el manifiesto.');
  }
  for (const path of manifestPaths) {
    if (!realSet.has(path)) add('stale_path', path + ' no existe en el inventario.');
  }

  for (const classification of CLASSES) {
    if (counts[classification] !== COUNTS[classification]) {
      add('classification_count', classification + '=' + counts[classification] + '; esperado=' + COUNTS[classification] + '.');
    }
    if (manifest?.expected_counts?.[classification] !== COUNTS[classification]) {
      add('declared_classification_count', 'expected_counts.' + classification + ' debe ser ' + COUNTS[classification] + '.');
    }
  }
  if (!manifest?.expected_counts || typeof manifest.expected_counts !== 'object' || Array.isArray(manifest.expected_counts)) {
    add('invalid_expected_counts', 'expected_counts debe ser un objeto.');
  } else {
    for (const classification of Object.keys(manifest.expected_counts)) {
      if (!CLASSES.includes(classification)) add('invalid_expected_classification', 'expected_counts contiene ' + classification + '.');
    }
  }

  for (const environment of ENVIRONMENTS) {
    for (const classification of CLASSES) {
      const expected = ENVIRONMENT_COUNTS[environment][classification];
      if (byEnvironment[environment][classification] !== expected) {
        add('environment_count', environment + '.' + classification + '=' + byEnvironment[environment][classification] + '; esperado=' + expected + '.');
      }
      if (manifest?.expected_environment_counts?.[environment]?.[classification] !== expected) {
        add('declared_environment_count', 'expected_environment_counts.' + environment + '.' + classification + ' debe ser ' + expected + '.');
      }
    }
  }
  if (!manifest?.expected_environment_counts || typeof manifest.expected_environment_counts !== 'object' || Array.isArray(manifest.expected_environment_counts)) {
    add('invalid_expected_environment_counts', 'expected_environment_counts debe ser un objeto.');
  } else {
    for (const environment of Object.keys(manifest.expected_environment_counts)) {
      if (!ENVIRONMENTS.includes(environment)) add('invalid_expected_environment', 'expected_environment_counts contiene ' + environment + '.');
    }
  }

  for (const [path, expected] of Object.entries(A09)) {
    const matches = entries.filter((entry) => entry && entry.path === path);
    if (matches.length !== 1 || matches[0]?.classification !== expected[0] || matches[0]?.environment !== expected[1]) {
      add('a09_classification', path + ' debe aparecer una vez como ' + expected[0] + '/' + expected[1] + '.');
    }
  }
  const p01 = entries.filter((entry) => entry && entry.path === 'tests/pm33/db/p01-aislamiento-multiempresa-contract.mjs');
  if (p01.length !== 1 || p01[0]?.classification !== 'historical_expected_fail' || p01[0]?.environment !== 'postgres') {
    add('historical_contract', 'P01 debe aparecer una vez como historical_expected_fail/postgres.');
  }

  return { issues, counts, byEnvironment };
}

function selfTest(manifest, realPaths) {
  const baseline = validate(manifest, realPaths);
  if (baseline.issues.length > 0) {
    for (const issue of baseline.issues) process.stderr.write(issue.code + ': ' + issue.message + '\n');
    throw new Error('El manifiesto base no es válido para las pruebas negativas.');
  }
  const source = manifest.entries;
  const omittedIndex = source.findIndex((entry) => entry.classification === 'active_contract' && entry.environment === 'node');
  const omitted = source[omittedIndex];
  const duplicate = source.find((entry) => entry.path !== omitted?.path &&
    entry.classification === omitted?.classification && entry.environment === omitted?.environment);
  if (!omitted || !duplicate) throw new Error('No se encontró un par de contratos Node para las pruebas negativas.');

  const spoofed = source.map((entry) => ({ ...entry }));
  spoofed.splice(omittedIndex, 1);
  spoofed.push({ ...duplicate, environment: 'unknown_environment' });
  const spoofedActive = spoofed.filter((entry) => entry.classification === 'active_contract').length;
  if (spoofed.length !== INVENTORY || spoofedActive !== COUNTS.active_contract) {
    throw new Error('El caso combinado no conserva 153 entradas y 139 contratos activos.');
  }
  const spoofedCodes = new Set(validate({ ...manifest, entries: spoofed }, realPaths).issues.map((issue) => issue.code));
  if (!['invalid_environment', 'duplicate_path', 'missing_path'].every((code) => spoofedCodes.has(code))) {
    throw new Error('No se rechazó el entorno desconocido con duplicado: ' + [...spoofedCodes].join(','));
  }
  process.stdout.write('NEGATIVE_UNKNOWN_ENVIRONMENT_DUPLICATE=REJECTED\n');

  const duplicated = source.map((entry) => ({ ...entry }));
  duplicated.splice(omittedIndex, 1);
  duplicated.push({ ...duplicate });
  const duplicateCodes = new Set(validate({ ...manifest, entries: duplicated }, realPaths).issues.map((issue) => issue.code));
  if (!duplicateCodes.has('duplicate_path') || !duplicateCodes.has('missing_path')) {
    throw new Error('No se rechazó la ruta duplicada: ' + [...duplicateCodes].join(','));
  }
  process.stdout.write('NEGATIVE_DUPLICATE_PATH=REJECTED\n');

  const invalidClass = source.map((entry) => ({ ...entry }));
  invalidClass[omittedIndex] = { ...invalidClass[omittedIndex], classification: 'unknown_classification' };
  const invalidClassCodes = new Set(validate({ ...manifest, entries: invalidClass }, realPaths).issues.map((issue) => issue.code));
  if (!invalidClassCodes.has('invalid_classification')) {
    throw new Error('No se rechazó la clasificación inválida: ' + [...invalidClassCodes].join(','));
  }
  process.stdout.write('NEGATIVE_INVALID_CLASSIFICATION=REJECTED\n');
}

try {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  process.chdir(root);
  const manifest = JSON.parse(readFileSync(resolve(root, 'tests/ci/manifiesto_clasificacion.json'), 'utf8'));
  const realPaths = execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD', '--', 'tests/'], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter((path) => path.endsWith('.mjs'))
    .sort();
  const result = validate(manifest, realPaths);

  if (process.argv[2] === '--self-test') {
    selfTest(manifest, realPaths);
    process.stdout.write('MANIFEST_VALIDATOR_NEGATIVE_TESTS=PASS\n');
  } else if (process.argv.length > 2) {
    throw new Error('Uso: validar-manifiesto-ci.mjs [--self-test]');
  } else if (result.issues.length > 0) {
    for (const issue of result.issues) process.stderr.write(issue.code + ': ' + issue.message + '\n');
    process.exitCode = 1;
  } else {
    process.stdout.write(JSON.stringify({ ...result.counts, total_inventory: realPaths.length, byEnvironment: result.byEnvironment }));
  }
} catch (error) {
  process.stderr.write('MANIFEST_VALIDATION_ERROR: ' + error.message + '\n');
  process.exitCode = 1;
}