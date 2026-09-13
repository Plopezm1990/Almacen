import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// PM27 / C13 / Punto 7
// Orquestador reproducible de regresiones. No conecta a Supabase remoto ni
// modifica QA/produccion. El gate del Punto 8 lo ejecuta en runner aislado.

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..', '..');

function rel(...parts) {
  return path.join(ROOT, ...parts);
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function runNode(testPath, { label = testPath } = {}) {
  const abs = rel(...testPath.split('/'));
  assert.ok(fs.existsSync(abs), `falta regresion requerida: ${testPath}`);
  console.log(`\n==> ${label}: ${testPath}`);
  const r = spawnSync(process.execPath, [abs], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 10 * 60 * 1000,
    env: { ...process.env, PM27_C13_REGRESSION: '1' },
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  assert.equal(r.status, 0, `${label} fallo con status ${r.status}`);
}

// --- 1) Invariantes de alcance: C13 no sustituye el motor moderno de TPV/stock. ---
const c13MigrationPath = rel('supabase', 'migrations', '20260913190500_pm27_c13_security_definer_tenant_guard.sql');
const c13HardeningPath = rel('supabase', 'migrations', '20260913193500_pm27_c13_private_helper_hardening.sql');
const operationGlobalPath = rel('supabase', 'migrations', '20260905120500_pm09_operation_id_global_hardening.sql');
const p09fGlobalPath = rel('supabase', 'migrations', '20260912120000_pm26_p09f_b3_pagos_encargo_operation_id_global.sql');

for (const p of [c13MigrationPath, c13HardeningPath, operationGlobalPath, p09fGlobalPath]) {
  assert.ok(fs.existsSync(p), `falta artefacto requerido: ${path.relative(ROOT, p)}`);
}

const c13Sql = fs.readFileSync(c13MigrationPath, 'utf8');
assert.doesNotMatch(
  c13Sql,
  /drop\s+function\s+(?:if\s+exists\s+)?public\.(?:registrar_venta_stock_carrito_pm09|revertir_venta_stock_carrito_pm09)\b/i,
  'C13 no puede retirar las RPC modernas de venta/reverso'
);
assert.match(c13Sql, /revoke all on function public\.descontar_stock_carrito\(jsonb,text\) from authenticated;/i);
assert.match(c13Sql, /revoke all on function public\.anular_venta_tpv\(text,text\) from authenticated;/i);

const operationGlobal = fs.readFileSync(operationGlobalPath, 'utf8');
assert.match(operationGlobal, /operation_id/i, 'el hardening PM09 de operation_id debe seguir versionado');
const p09fGlobal = fs.readFileSync(p09fGlobalPath);
assert.match(p09fGlobal.toString('utf8'), /operation_id/i, 'el ledger global PM26 P09f-B3 debe seguir versionado');
console.log('PM27_C13_REG_ALCANCE_MOTOR_MODERNO=PASS');

// --- 2) TPV, stock, anulacion y caja/devoluciones mantenidas. ---
for (const test of [
  'tests/pm07/frontend-contract.mjs',
  'tests/pm08/frontend-contract.mjs',
  'tests/pm08/migration-contract.mjs',
  'tests/pm08/replay-scope-contract.mjs',
]) {
  runNode(test, { label: 'TPV/stock/anulacion' });
}
console.log('PM27_C13_REG_TPV_STOCK_ANULACION=PASS');

// --- 3) Trazabilidad, movimientos, permisos, replay y concurrencia de PM12. ---
for (const test of [
  'tests/pm12/p05-ajustes-trazables-contract.mjs',
  'tests/pm12/p06-cancelacion-conservadora-contract.mjs',
  'tests/pm12/p07-permisos-aislamiento-ajustes-contract.mjs',
  'tests/pm12/p08-fallos-replay-concurrencia-contract.mjs',
  'tests/pm12/p08-instancias-fallos-contract.mjs',
]) {
  runNode(test, { label: 'movimientos/replay' });
}
console.log('PM27_C13_REG_MOVIMIENTOS=PASS');
console.log('PM27_C13_REG_REPLAY_CONCURRENCIA=PASS');

// Compatibilidad posterior al ledger global de pagos_encargo.
runNode('tests/pm27/p08c-post-p09f-compat.test.mjs', { label: 'operation_id global' });
console.log('PM27_C13_REG_OPERATION_ID=PASS');

// --- 4) Contratos PM26 aplicables. ---
// Se reproduce exactamente la excepcion historica ya usada por el workflow
// candidato PM27: P05b/P05c dependian del antiguo invariante release==main.
// P08c..P08g se ejecutan como existian ANTES de P09f-B3 y, por definicion,
// antes de las dos migraciones C13. Los tres artefactos posteriores se retiran
// solo del worktree de CI y se restauran byte a byte tras cada prueba.
const pm26Dir = rel('tests', 'pm26');
const allPm26 = fs.readdirSync(pm26Dir)
  .filter((name) => name.endsWith('-contract.mjs'))
  .sort();

assert.ok(allPm26.length > 0, 'no se encontraron contratos PM26');

const skipHistoricalReleaseInvariant = new Set([
  'p05b-contract.mjs',
  'p05c-contract.mjs',
]);
const historicalBeforeP09fB3 = new Set([
  'p08c-contract.mjs',
  'p08d-contract.mjs',
  'p08e-contract.mjs',
  'p08f-contract.mjs',
  'p08g-contract.mjs',
]);

const posterioresAlInstanteP08b = [
  p09fGlobalPath,
  c13MigrationPath,
  c13HardeningPath,
];
const posterioresOriginales = new Map(
  posterioresAlInstanteP08b.map((p) => [p, fs.readFileSync(p)])
);
const posterioresHashes = new Map(
  [...posterioresOriginales.entries()].map(([p, data]) => [p, sha256Buffer(data)])
);

function ejecutarEnInstanteHistoricoP08b(test) {
  const temporales = new Map();
  try {
    for (const p of posterioresAlInstanteP08b) {
      assert.ok(fs.existsSync(p), `falta artefacto posterior antes de aislar: ${path.relative(ROOT, p)}`);
      const tempPath = `${p}.pm27-c13-temporal`;
      assert.ok(!fs.existsSync(tempPath), `archivo temporal inesperado: ${path.relative(ROOT, tempPath)}`);
      fs.renameSync(p, tempPath);
      temporales.set(p, tempPath);
    }
    runNode(test, { label: 'PM26 alcance historico pre-P09f-B3/C13' });
  } finally {
    for (const p of posterioresAlInstanteP08b) {
      const tempPath = temporales.get(p) || `${p}.pm27-c13-temporal`;
      if (fs.existsSync(p)) fs.rmSync(p);
      if (fs.existsSync(tempPath)) fs.renameSync(tempPath, p);
      else fs.writeFileSync(p, posterioresOriginales.get(p));
    }
  }

  for (const p of posterioresAlInstanteP08b) {
    assert.ok(fs.existsSync(p), `artefacto no restaurado: ${path.relative(ROOT, p)}`);
    assert.equal(
      sha256Buffer(fs.readFileSync(p)),
      posterioresHashes.get(p),
      `la reproduccion historica altero ${path.relative(ROOT, p)}`
    );
  }
}

for (const name of allPm26) {
  const test = `tests/pm26/${name}`;

  if (skipHistoricalReleaseInvariant.has(name)) {
    console.log(`==> ${test} [omitido: invariante historico release==main sustituido en PM27]`);
    continue;
  }

  if (historicalBeforeP09fB3.has(name)) {
    ejecutarEnInstanteHistoricoP08b(test);
    continue;
  }

  runNode(test, { label: 'PM26' });
}

for (const p of posterioresAlInstanteP08b) {
  assert.equal(
    sha256Buffer(fs.readFileSync(p)),
    posterioresHashes.get(p),
    `artefacto posterior debe quedar byte-a-byte intacto: ${path.relative(ROOT, p)}`
  );
}
assert.equal(fs.readFileSync(p09fGlobalPath).compare(p09fGlobal), 0, 'P09f-B3 debe quedar byte-a-byte intacta');
console.log('PM27_C13_REG_PM26=PASS');
console.log('PM27_C13_PUNTO7_REGRESIONES=PASS');
